import type { Timestamp } from 'firebase/firestore'

// ── Firestore document shape ──
export interface UserDoc {
  githubId: string
  username: string
  name: string
  avatar: string
  email: string
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── App-level type (after converting timestamps) ──
export interface User {
  uid: string
  githubId: string
  username: string
  name: string
  avatar: string
  email: string
  createdAt: Date
  updatedAt: Date
}

// ── Input type for creating a new user ──
export type CreateUserInput = Omit<UserDoc, 'createdAt' | 'updatedAt'>

// ── What the GitHub API returns (raw) ──
export interface GitHubProfile {
  id: number
  login: string
  name: string | null
  avatar_url: string
  email: string | null
  bio: string | null
  public_repos: number
}

// ── Server-only token document (/users/{id}/private/tokens) ──
export interface UserTokenDoc {
  accessToken: string
}
