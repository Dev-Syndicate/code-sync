// POST /api/sessions/[id]/agent
// Streaming AI agent endpoint. Takes the user's message + open-file context
// and streams Gemini's response back to the client as Server-Sent Events.
//
// Events:
//   event: text_delta     data: {"text":"..."}
//   event: edit_proposal  data: { ...EditProposal }
//   event: done           data: {}
//   event: error          data: {"message":"..."}
//
// Pre-stream failures (auth, missing key, bad body, rate limit) return a
// normal JSON apiError with the appropriate HTTP status. Once the stream
// has started we always return 200 and surface errors as an 'error' event.

import { type NextRequest } from 'next/server'
import { apiError } from '@/lib/api/response'
import { getAuthContext } from '@/lib/api/auth'
import { adminDb } from '@/lib/firebase/admin'
import {
  getGeminiClient,
  DEFAULT_MODEL,
  GeminiConfigError,
} from '@/lib/gemini/client'
import { buildAgentContents, SYSTEM_INSTRUCTION } from '@/lib/gemini/prompt'
import {
  ProposalStreamParser,
  finalizeProposal,
} from '@/lib/gemini/proposals'
import type {
  AgentOpenFile,
  AgentRequestBody,
  EditProposal,
} from '@/types/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── In-memory per-uid rate limit (best-effort, per-instance) ──────────────
const RATE_LIMIT_PER_MINUTE = 20
const rateBuckets = new Map<string, { count: number; windowStart: number }>()

function checkRateLimit(uid: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(uid)
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(uid, { count: 1, windowStart: now })
    return true
  }
  bucket.count += 1
  return bucket.count <= RATE_LIMIT_PER_MINUTE
}

// ── Validation ────────────────────────────────────────────────────────────
function validateBody(raw: unknown): AgentRequestBody | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const message = r.message
  const openFiles = r.openFiles
  const history = r.history
  if (typeof message !== 'string' || !message.trim()) return null
  if (!Array.isArray(openFiles)) return null
  if (!Array.isArray(history)) return null

  for (const f of openFiles) {
    if (!f || typeof f !== 'object') return null
    const fo = f as Record<string, unknown>
    if (
      typeof fo.path !== 'string' ||
      typeof fo.language !== 'string' ||
      typeof fo.content !== 'string' ||
      typeof fo.isActive !== 'boolean'
    ) {
      return null
    }
  }
  for (const h of history) {
    if (!h || typeof h !== 'object') return null
    const ho = h as Record<string, unknown>
    if (
      (ho.role !== 'user' && ho.role !== 'assistant') ||
      typeof ho.text !== 'string'
    ) {
      return null
    }
  }

  return {
    message,
    openFiles: openFiles as AgentOpenFile[],
    history: history as AgentRequestBody['history'],
  }
}

// ── SSE helpers ───────────────────────────────────────────────────────────
function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

// ── POST handler ──────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Auth
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    console.error('[POST /api/sessions/[id]/agent] auth failed:', err)
    return apiError('AUTH_REQUIRED', 'Authentication required.', 401)
  }

  // 2. Session membership
  const { id: sessionId } = await params
  if (!sessionId) {
    return apiError('VALIDATION_ERROR', 'Session id is required.', 400)
  }

  let sessionSnap
  try {
    sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  } catch (err) {
    console.error(
      '[POST /api/sessions/[id]/agent] firestore read failed:',
      err
    )
    return apiError('INTERNAL_ERROR', 'Failed to load session.', 500)
  }
  if (!sessionSnap.exists) {
    return apiError('NOT_FOUND', 'Session not found.', 404)
  }
  const sessionData = sessionSnap.data() as {
    owner: string
    participants?: Record<string, unknown>
  }
  const isOwner = sessionData.owner === uid
  const isParticipant =
    !!sessionData.participants && uid in sessionData.participants
  if (!isOwner && !isParticipant) {
    return apiError('FORBIDDEN', 'You are not a member of this session.', 403)
  }

  // 3. Rate limit
  if (!checkRateLimit(uid)) {
    return apiError(
      'RATE_LIMITED',
      'Too many agent requests. Try again in a minute.',
      429
    )
  }

  // 4. Parse body
  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return apiError('VALIDATION_ERROR', 'Invalid JSON body.', 400)
  }
  const body = validateBody(bodyJson)
  if (!body) {
    return apiError(
      'VALIDATION_ERROR',
      'Request body is missing required fields.',
      400
    )
  }

  // 5. Gemini client
  let client
  try {
    client = getGeminiClient()
  } catch (err) {
    if (err instanceof GeminiConfigError) {
      return apiError(
        'GEMINI_NOT_CONFIGURED',
        'AI Agent is not configured. Set GEMINI_API_KEY on the server.',
        500
      )
    }
    console.error('[POST /api/sessions/[id]/agent] client init failed:', err)
    return apiError('INTERNAL_ERROR', 'Failed to initialize Gemini.', 500)
  }

  // 6. Build prompt
  const { contents } = buildAgentContents({
    userMessage: body.message,
    openFiles: body.openFiles,
    history: body.history,
  })

  // 7. Stream
  const encoder = new TextEncoder()
  const parser = new ProposalStreamParser()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseFrame(event, data)))
      }

      const emitParserEvents = (
        events: ReturnType<ProposalStreamParser['push']>
      ) => {
        for (const ev of events) {
          if (ev.type === 'text' && ev.text) {
            send('text_delta', { text: ev.text })
          } else if (ev.type === 'proposal' && ev.proposal) {
            const full: EditProposal = finalizeProposal(ev.proposal)
            send('edit_proposal', full)
          }
        }
      }

      try {
        const result = await client.models.generateContentStream({
          model: DEFAULT_MODEL,
          contents,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
          },
        })

        for await (const chunk of result) {
          const text = chunk.text
          if (typeof text === 'string' && text.length > 0) {
            emitParserEvents(parser.push(text))
          }
        }

        // Flush any tail prose / unterminated blocks.
        emitParserEvents(parser.flush())

        send('done', {})
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unknown Gemini error'
        console.error(
          '[POST /api/sessions/[id]/agent] stream error:',
          err
        )
        try {
          send('error', { message: `Gemini: ${message}` })
        } catch {
          // controller may already be closed
        }
      } finally {
        try {
          controller.close()
        } catch {
          // already closed
        }
      }
    },

    cancel() {
      // Client aborted — nothing to clean up; the async iterator will
      // throw on next read and we'll hit the catch above.
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  })
}
