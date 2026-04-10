// Dev 1 — Auth helpers
// GitHub OAuth login/logout via Firebase, session cookie management

import {
  GithubAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
  type Unsubscribe,
} from 'firebase/auth'
import { auth } from '@/lib/firebase/config'
import { createUser, getUser, updateUser, saveUserToken } from '@/lib/firebase/models/user'
import type { User, CreateUserInput, GitHubProfile } from '@/types'

// ── Cookie helpers ──

function setCookie(name: string, value: string, days: number): void {
  const expires = new Date(Date.now() + days * 864e5).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

function deleteCookie(name: string): void {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`
}

// ── GitHub profile fetcher ──

async function fetchGitHubProfile(accessToken: string): Promise<GitHubProfile> {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  })

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status}`)
  }

  return res.json()
}

// ── Login with GitHub OAuth ──

/**
 * Triggers GitHub OAuth via Firebase popup.
 * After successful auth:
 * 1. Extracts the GitHub access token from the credential
 * 2. Fetches the GitHub user profile
 * 3. Creates or updates the user in Firestore
 * 4. Stores the access token in Firestore (private subcollection)
 * 5. Sets a session cookie for middleware route protection
 */
export async function loginWithGitHub(): Promise<User> {
  const provider = new GithubAuthProvider()
  provider.addScope('repo')
  provider.addScope('read:user')

  const result = await signInWithPopup(auth, provider)
  const credential = GithubAuthProvider.credentialFromResult(result)

  if (!credential) {
    throw new Error('Failed to get GitHub credential')
  }

  const accessToken = credential.accessToken
  if (!accessToken) {
    throw new Error('Failed to get GitHub access token')
  }

  const firebaseUser = result.user
  const uid = firebaseUser.uid

  // Fetch full GitHub profile using the access token
  const profile = await fetchGitHubProfile(accessToken)

  // Check if user already exists in Firestore
  const existingUser = await getUser(uid)

  let user: User

  if (existingUser) {
    // Update existing user with latest GitHub profile data
    await updateUser(uid, {
      username: profile.login,
      name: profile.name ?? profile.login,
      avatar: profile.avatar_url,
      email: profile.email ?? '',
    })
    user = {
      ...existingUser,
      username: profile.login,
      name: profile.name ?? profile.login,
      avatar: profile.avatar_url,
      email: profile.email ?? '',
      updatedAt: new Date(),
    }
  } else {
    // Create new user in Firestore
    const input: CreateUserInput = {
      githubId: String(profile.id),
      username: profile.login,
      name: profile.name ?? profile.login,
      avatar: profile.avatar_url,
      email: profile.email ?? '',
    }
    user = await createUser(uid, input)
  }

  // Store GitHub access token in private subcollection
  await saveUserToken(uid, accessToken)

  // Set session cookie for middleware route protection (7 days)
  setCookie('session', uid, 7)

  return user
}

// ── Logout ──

/**
 * Signs the user out of Firebase Auth and clears the session cookie.
 */
export async function logoutUser(): Promise<void> {
  await signOut(auth)
  deleteCookie('session')
}

// ── Auth state listener ──

/**
 * Subscribes to Firebase Auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthChange(
  callback: (firebaseUser: FirebaseUser | null) => void
): Unsubscribe {
  return onAuthStateChanged(auth, callback)
}
