// Server-only Gemini client singleton.
//
// Reads GEMINI_API_KEY from the environment. Never import this from a client
// component — it must only be used inside API route handlers.

import { GoogleGenAI } from '@google/genai'

export class GeminiConfigError extends Error {
  constructor(message = 'GEMINI_API_KEY is not set') {
    super(message)
    this.name = 'GeminiConfigError'
  }
}

export const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash'

let cached: GoogleGenAI | null = null

export function getGeminiClient(): GoogleGenAI {
  if (cached) return cached
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new GeminiConfigError()
  cached = new GoogleGenAI({ apiKey })
  return cached
}
