import type { ApiResponse, ErrorCode } from '@/types/api'

// ── Success response ──────────────────────────────────────────────────────────
export function apiSuccess<T>(data: T, status = 200): Response {
  return Response.json(
    { success: true, data } satisfies ApiResponse<T>,
    { status }
  )
}

// ── Error response ────────────────────────────────────────────────────────────
export function apiError(
  code: ErrorCode | string,
  message: string,
  status = 400
): Response {
  return Response.json(
    { success: false, error: { code: code as ErrorCode, message } } satisfies ApiResponse,
    { status }
  )
}
