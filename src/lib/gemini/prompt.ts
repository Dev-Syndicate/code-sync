// Prompt builder for the AI coding agent.
//
// Produces the `contents` array passed to Gemini's generateContentStream,
// plus the system instruction. The shape mirrors @google/genai: an array of
// { role, parts: [{ text }] } where role is 'user' or 'model'.

import type { AgentOpenFile, AgentRole } from '@/types/agent'

const MAX_LINES_PER_FILE = 600
const MAX_TOTAL_CHARS = 120_000

// Per the SDK: role can be 'user' or 'model'. We map our 'assistant' → 'model'.
export interface GeminiContent {
  role: 'user' | 'model'
  parts: Array<{ text: string }>
}

export const SYSTEM_INSTRUCTION = `You are CodeSync's in-editor coding assistant.

The user is collaboratively editing code with peers in a shared session. They
have opened one or more files in their editor, and you will see the current
content of each.

## Output format

Write your reply in plain markdown prose. When you want to propose a code
edit, emit a fenced block EXACTLY like this (one JSON object per block, and
the opening fence language MUST be "codesync-edit"):

\`\`\`codesync-edit
{
  "filePath": "src/app/page.tsx",
  "mode": "replace_range",
  "range": { "startLine": 10, "startCol": 1, "endLine": 12, "endCol": 1 },
  "newContent": "// the replacement content\\n",
  "explanation": "Short human-readable reason for the change."
}
\`\`\`

Rules for proposals:
- "filePath" MUST match one of the OPEN FILES exactly.
- "mode" is either "replace_range" (preferred, for small/local edits) or
  "replace_file" (for whole-file rewrites).
- "range" is REQUIRED when mode is "replace_range". Coordinates are
  1-indexed Monaco coordinates: startLine/startCol (inclusive) and
  endLine/endCol (exclusive). Column 1 is the first column.
- "newContent" is ONLY the replacement text. For replace_range, do NOT
  include unchanged surrounding lines. For replace_file, it's the full new
  file content.
- "explanation" is one short sentence.
- NEVER claim to have applied the edit. The user will click Accept in the
  UI to apply it through Yjs; until then, nothing changes.
- You may emit multiple fenced blocks in one reply if needed, but prefer
  one coherent change per reply.
- You may also answer questions without proposing any edits — in that case
  just write prose, no fenced blocks.

Outside the fenced blocks, explain your reasoning briefly. Do not wrap your
whole reply in a code block.`

// ── File block formatting ─────────────────────────────────────────────────
function truncateFile(content: string): { text: string; truncated: boolean } {
  const lines = content.split('\n')
  if (lines.length <= MAX_LINES_PER_FILE) {
    return { text: content, truncated: false }
  }
  const half = Math.floor(MAX_LINES_PER_FILE / 2)
  const head = lines.slice(0, half).join('\n')
  const tail = lines.slice(-half).join('\n')
  const omitted = lines.length - half * 2
  return {
    text: `${head}\n// ... [truncated ${omitted} lines] ...\n${tail}`,
    truncated: true,
  }
}

function formatOpenFiles(openFiles: AgentOpenFile[]): string {
  const sorted = [...openFiles].sort((a, b) =>
    a.isActive === b.isActive ? 0 : a.isActive ? -1 : 1
  )
  const blocks = sorted.map((f) => {
    const { text } = truncateFile(f.content)
    const marker = f.isActive ? '[ACTIVE] ' : ''
    return `### ${marker}${f.path} (${f.language})\n\`\`\`${f.language}\n${text}\n\`\`\``
  })
  return blocks.join('\n\n')
}

// ── Main builder ──────────────────────────────────────────────────────────
export interface BuildAgentContentsInput {
  userMessage: string
  openFiles: AgentOpenFile[]
  history: Array<{ role: AgentRole; text: string }>
}

export interface BuildAgentContentsResult {
  contents: GeminiContent[]
  contextTruncated: boolean
  totalChars: number
}

export function buildAgentContents(
  input: BuildAgentContentsInput
): BuildAgentContentsResult {
  const { userMessage, openFiles, history } = input

  // 1. History turns (previous conversation, excluding the new user message).
  //    Gemini wants 'user' / 'model' roles and expects them to alternate
  //    starting with 'user'. We trust the store to maintain that.
  const historyContents: GeminiContent[] = history.map((h) => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.text }],
  }))

  // 2. The new user turn: open files block + the request.
  const filesBlock = formatOpenFiles(openFiles)
  const userTurnText = `## OPEN FILES\n${filesBlock}\n\n## REQUEST\n${userMessage}`

  // 3. Enforce a hard char cap. If we overflow, drop the oldest history
  //    turns until we fit (never drop the current user turn).
  let totalChars = userTurnText.length
  for (const h of historyContents) totalChars += h.parts[0].text.length

  const trimmedHistory = [...historyContents]
  let contextTruncated = false
  while (totalChars > MAX_TOTAL_CHARS && trimmedHistory.length > 0) {
    const dropped = trimmedHistory.shift()!
    totalChars -= dropped.parts[0].text.length
    contextTruncated = true
  }

  const contents: GeminiContent[] = [
    ...trimmedHistory,
    { role: 'user', parts: [{ text: userTurnText }] },
  ]

  return { contents, contextTruncated, totalChars }
}
