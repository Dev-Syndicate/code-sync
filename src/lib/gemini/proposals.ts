// Incremental parser that splits a streaming model reply into:
//   - text_delta events   (prose outside fenced blocks)
//   - edit_proposal events (one per successfully parsed ```codesync-edit block)
//
// The parser is fed chunks of model output as they arrive and drains
// complete events on each call. It is intentionally forgiving: if a fenced
// block fails to parse as JSON, the raw fenced text is passed through as
// prose so the user can still see what the model tried to do.

import type {
  EditProposal,
  EditProposalRange,
  RawEditProposal,
} from '@/types/agent'

const FENCE_LANG = 'codesync-edit'
const OPEN_FENCE = '```' + FENCE_LANG
const CLOSE_FENCE = '```'

type ParserState =
  | { kind: 'prose' }
  | { kind: 'in_block'; blockStart: number } // index in buffer where inner JSON begins

export interface ProposalParseEvent {
  type: 'text' | 'proposal'
  text?: string
  proposal?: RawEditProposal
}

export class ProposalStreamParser {
  private buffer = ''
  private state: ParserState = { kind: 'prose' }

  /**
   * Feed a chunk of model output. Returns any events that became complete
   * as a result of this chunk. Prose events are emitted as soon as we know
   * they cannot be part of a fence opening. Proposal events are emitted
   * only when the closing fence is seen.
   */
  push(chunk: string): ProposalParseEvent[] {
    this.buffer += chunk
    const events: ProposalParseEvent[] = []

    // Drain as many complete segments as we can in this pass.
    // Each loop iteration either:
    //   - flushes a prose segment up to an OPEN_FENCE, or
    //   - flushes a proposal up to CLOSE_FENCE, or
    //   - breaks because we need more input.
    while (true) {
      if (this.state.kind === 'prose') {
        const openIdx = this.buffer.indexOf(OPEN_FENCE)
        if (openIdx === -1) {
          // No fence in sight. Flush everything EXCEPT the last few chars
          // that might be the start of an open fence (worst case: the full
          // length of OPEN_FENCE minus 1).
          const safeFlushEnd = Math.max(
            0,
            this.buffer.length - (OPEN_FENCE.length - 1)
          )
          if (safeFlushEnd > 0) {
            const text = this.buffer.slice(0, safeFlushEnd)
            if (text) events.push({ type: 'text', text })
            this.buffer = this.buffer.slice(safeFlushEnd)
          }
          break
        }

        // Flush prose up to the fence opener.
        if (openIdx > 0) {
          events.push({ type: 'text', text: this.buffer.slice(0, openIdx) })
        }
        // Advance past the opener; the inner JSON starts after the newline
        // that typically follows "```codesync-edit".
        const afterFence = openIdx + OPEN_FENCE.length
        // Skip an optional single newline right after the fence.
        const innerStart =
          this.buffer[afterFence] === '\n' ? afterFence + 1 : afterFence
        this.buffer = this.buffer.slice(innerStart)
        this.state = { kind: 'in_block', blockStart: 0 }
        continue
      }

      // state.kind === 'in_block' — we're inside a fenced block.
      const closeIdx = this.buffer.indexOf(CLOSE_FENCE)
      if (closeIdx === -1) {
        // Need more input to find the closing fence.
        break
      }

      const rawJson = this.buffer.slice(0, closeIdx).trim()
      // Consume the closing fence (and any single newline right after it).
      let nextStart = closeIdx + CLOSE_FENCE.length
      if (this.buffer[nextStart] === '\n') nextStart += 1
      this.buffer = this.buffer.slice(nextStart)
      this.state = { kind: 'prose' }

      const proposal = tryParseProposal(rawJson)
      if (proposal) {
        events.push({ type: 'proposal', proposal })
      } else {
        // Parse failed — surface the raw block as prose so the user sees it.
        events.push({
          type: 'text',
          text: '\n```\n' + rawJson + '\n```\n',
        })
      }
    }

    return events
  }

  /**
   * Flush any remaining buffered prose at end-of-stream. If we're still
   * inside an unterminated fenced block, surface it as prose so nothing is
   * silently dropped.
   */
  flush(): ProposalParseEvent[] {
    const events: ProposalParseEvent[] = []
    if (this.state.kind === 'in_block') {
      if (this.buffer.length > 0) {
        events.push({
          type: 'text',
          text: '\n```\n' + this.buffer + '\n```\n',
        })
      }
    } else if (this.buffer.length > 0) {
      events.push({ type: 'text', text: this.buffer })
    }
    this.buffer = ''
    this.state = { kind: 'prose' }
    return events
  }
}

// ── Validation ────────────────────────────────────────────────────────────
function tryParseProposal(raw: string): RawEditProposal | null {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return null
  }
  if (!obj || typeof obj !== 'object') return null
  const o = obj as Record<string, unknown>

  const filePath = o.filePath
  const mode = o.mode
  const newContent = o.newContent
  const explanation = o.explanation

  if (typeof filePath !== 'string' || !filePath) return null
  if (mode !== 'replace_file' && mode !== 'replace_range') return null
  if (typeof newContent !== 'string') return null
  if (typeof explanation !== 'string') return null

  let range: EditProposalRange | undefined
  if (mode === 'replace_range') {
    const r = o.range
    if (!r || typeof r !== 'object') return null
    const rr = r as Record<string, unknown>
    const nums = ['startLine', 'startCol', 'endLine', 'endCol'] as const
    for (const k of nums) {
      if (typeof rr[k] !== 'number' || !Number.isFinite(rr[k])) return null
    }
    range = {
      startLine: rr.startLine as number,
      startCol: rr.startCol as number,
      endLine: rr.endLine as number,
      endCol: rr.endCol as number,
    }
  }

  return { filePath, mode, range, newContent, explanation }
}

// ── Offset helpers (used by the client when applying an accepted edit) ───
// 1-indexed Monaco line/col → 0-indexed absolute string offset.
export function lineColToOffset(
  text: string,
  line: number,
  col: number
): number {
  // Clamp
  const lines = text.split('\n')
  const safeLine = Math.max(1, Math.min(line, lines.length))
  let offset = 0
  for (let i = 0; i < safeLine - 1; i += 1) {
    offset += lines[i].length + 1 // +1 for the \n
  }
  const lineLen = lines[safeLine - 1]?.length ?? 0
  const safeCol = Math.max(1, Math.min(col, lineLen + 1))
  offset += safeCol - 1
  return offset
}

// ── Finalize a raw proposal into an EditProposal (adds id, status, createdAt).
export function finalizeProposal(raw: RawEditProposal): EditProposal {
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `prop_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    filePath: raw.filePath,
    mode: raw.mode,
    range: raw.range,
    newContent: raw.newContent,
    explanation: raw.explanation,
    status: 'pending',
    createdAt: Date.now(),
  }
}
