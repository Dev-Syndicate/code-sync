export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: ApiError
}

export interface ApiError {
  code: ErrorCode
  message: string
}

export type ErrorCode =
  | 'AUTH_REQUIRED'
  | 'AUTH_EXPIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'SESSION_FULL'
  | 'SESSION_CLOSED'
  | 'GITHUB_ERROR'
  | 'COMMIT_FAILED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
