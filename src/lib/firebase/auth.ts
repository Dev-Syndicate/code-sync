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
import { createUser, getUser, updateUser } from '@/lib/firebase/models/user'
import type { User, CreateUserInput, GitHubProfile } from '@/types'

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
 * 1. Extracts the GitHub access token and Firebase ID token
 * 2. Fetches the GitHub user profile
 * 3. Creates or updates the user in Firestore directly from the client
 * 4. Calls Dev 4's /api/auth/session contract passing both tokens to handle secure cookie + token storage
 */
export async function loginWithGitHub(): Promise<User> {
  const provider = new GithubAuthProvider()
  provider.addScope('repo')
  provider.addScope('read:user')

  // If Firebase already has a persisted user from a previous session,
  // signInWithPopup can return a result whose OAuth credential is null
  // (Firebase only hands back the provider credential on a genuine fresh
  // sign-in). That leaves us with no accessToken to store server-side,
  // so we force a clean slate first.
  if (auth.currentUser) {
    await signOut(auth)
  }

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
  const idToken = await firebaseUser.getIdToken()

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

  // Contract: Call Dev 4's API to set the secure HTTP-only session cookie
  // and securely store the GitHub access token in the private subcollection.
  const res = await fetch('/api/auth/session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, accessToken }),
  })

  if (!res.ok) {
    throw new Error('Failed to create server session')
  }

  return user
}

// ── Server session reconciliation ──

/**
 * If the Firebase client has a signed-in user but the server session cookie
 * is missing or invalid (e.g. cookie expired, user cleared cookies, cookie
 * was minted by an older build), the app enters a redirect loop between
 * /login and /dashboard because middleware trusts the cookie and the login
 * page trusts Firebase.
 *
 * This function repairs that by re-posting a fresh idToken to
 * POST /api/auth/session, which mints a new server session cookie. Call it
 * from the login page before deciding to redirect to /dashboard.
 *
 * Returns true if the server session is now valid, false if we had to sign
 * the user out (no GitHub accessToken available to repair the session).
 */
export async function syncServerSession(): Promise<boolean> {
  const firebaseUser = auth.currentUser
  if (!firebaseUser) return false

  // We need a GitHub access token to re-run POST /api/auth/session, but the
  // client doesn't have one after a page reload (it lives only in the
  // signInWithPopup result). If there's no valid server session AND we can't
  // mint one without a fresh OAuth round-trip, sign out so the user sees the
  // login button instead of looping.
  //
  // Quick probe: does the server currently consider us authenticated?
  const probe = await fetch('/api/auth/session', { method: 'GET', cache: 'no-store' })
  if (probe.ok) {
    // The server still has a valid cookie (or will accept the current one).
    // Additional check: hit a protected endpoint to confirm the cookie
    // actually verifies, since the GET handler is a static stub.
    const protectedProbe = await fetch('/api/sessions', { method: 'GET', cache: 'no-store' })
    if (protectedProbe.status !== 401) return true
  }

  // Server rejected us. We cannot re-mint without a GitHub accessToken, so
  // sign out of Firebase and surface the login button.
  await signOut(auth)
  return false
}

// ── Logout ──

/**
 * Signs the user out of Firebase Auth and calls API to clear the secure session cookie.
 */
export async function logoutUser(): Promise<void> {
  // Clear the secure cookie via API
  await fetch('/api/auth/logout', { method: 'POST' })
  // Sign out of Firebase on the client
  await signOut(auth)
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
