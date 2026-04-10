// Auto-builds a commit message with GitHub co-author trailers.
//
// Sources of co-authors, in priority order:
//
//   1. Every participant currently in the session (session.participants).
//      This is the primary source — if you joined the session, you get
//      credit on commits made while you were in it, even if the per-file
//      editor tracking never caught a keystroke under your uid (e.g. you
//      were reviewing, pairing verbally, or the fileEditors write lost a
//      race). The user said this is the desired behavior: "add co-authors
//      of all the participants in the repo".
//
//   2. Every user recorded in the session's `fileEditors` subcollection.
//      Acts as a safety net for users who edited and then left the session
//      before the commit — they're no longer in participants, but their
//      contribution is still on record.
//
// The `committerId` is excluded (they're the GitHub author of the commit,
// so co-authoring themselves would be redundant and GitHub dedupes it
// anyway). For participant-initiated commits, we pass the session owner's
// uid as committerId because the commit is pushed under their token.

import { adminDb } from '@/lib/firebase/admin'
import type { EditorEntry, Participant } from '@/types/session'

interface CoAuthor {
  name:  string
  email: string
}

function formatCoAuthor({ name, email }: CoAuthor): string {
  return `Co-authored-by: ${name} <${email}>`
}

function noreplyEmail(username: string): string {
  return `${username}@users.noreply.github.com`
}

export async function buildCommitMessage(
  sessionId:   string,
  committerId: string,
  userMessage: string
): Promise<string> {
  // Keyed by uid so a user who appears in both sources is only listed once.
  // First write wins — participants are resolved first, so their display
  // name/email take precedence over the fileEditors snapshot.
  const coAuthors = new Map<string, CoAuthor>()

  // ── Source 1: session participants (current members) ──────────────────
  //
  // session.participants is a map keyed by uid with display metadata, but
  // it doesn't carry real emails. We fan out to /users/{uid} in parallel
  // to pull each participant's GitHub name + email. A failed lookup isn't
  // fatal — we just fall back to username + noreply email.
  const sessionSnap = await adminDb.collection('sessions').doc(sessionId).get()
  const sessionData = sessionSnap.data() as
    | { participants?: Record<string, Participant> }
    | undefined

  const participantUids = Object.keys(sessionData?.participants ?? {}).filter(
    (uid) => uid !== committerId,
  )

  if (participantUids.length > 0) {
    const userDocs = await Promise.all(
      participantUids.map((uid) => adminDb.collection('users').doc(uid).get()),
    )
    userDocs.forEach((snap, i) => {
      const uid = participantUids[i]
      const participant = sessionData!.participants![uid]
      const user = snap.exists
        ? (snap.data() as { name?: string; username?: string; email?: string })
        : null

      const username = user?.username ?? participant.username
      const name     = user?.name?.trim() || user?.username || participant.username
      const email    = user?.email?.trim() || noreplyEmail(username)

      coAuthors.set(uid, { name, email })
    })
  }

  // ── Source 2: fileEditors subcollection (historical editors) ──────────
  const editorsSnap = await adminDb
    .collection('sessions')
    .doc(sessionId)
    .collection('fileEditors')
    .get()

  editorsSnap.forEach((doc) => {
    const { editors } = doc.data() as { editors: EditorEntry[] }
    editors.forEach((editor) => {
      if (editor.userId === committerId) return
      if (coAuthors.has(editor.userId)) return // participant entry wins
      const email = editor.email?.trim() || noreplyEmail(editor.username)
      coAuthors.set(editor.userId, {
        name:  editor.githubName || editor.username,
        email,
      })
    })
  })

  // ── Assemble ──────────────────────────────────────────────────────────
  //
  // Sort by name for deterministic commit messages — otherwise Firestore's
  // non-deterministic map iteration would reshuffle trailers between runs
  // and make diffs noisy.
  const coAuthorLines = Array.from(coAuthors.values())
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(formatCoAuthor)
    .join('\n')

  // GitHub parses co-author trailers from the commit body (after a blank line).
  return coAuthorLines ? `${userMessage}\n\n${coAuthorLines}` : userMessage
}
