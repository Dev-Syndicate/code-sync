// GitHub Git Tree API — full commit flow
// Creates blobs → tree → commit → updates branch ref

import { githubFetch } from './api'
import type { CommitFile } from '@/types/github'

interface BlobResponse   { sha: string }
interface TreeResponse   { sha: string }
interface CommitResponse { sha: string }
interface RefResponse    { object: { sha: string } }

// ── Step 1: Create a blob for each file ──────────────────────────────────────
async function createBlob(
  token:   string,
  owner:   string,
  repo:    string,
  content: string
): Promise<string> {
  const res = await githubFetch<BlobResponse>(token, `/repos/${owner}/${repo}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({
      content:  Buffer.from(content).toString('base64'),
      encoding: 'base64',
    }),
  })
  return res.sha
}

// ── Step 2: Get the current HEAD commit SHA for the branch ───────────────────
async function getHeadCommitSha(
  token:  string,
  owner:  string,
  repo:   string,
  branch: string
): Promise<string> {
  const ref = await githubFetch<RefResponse>(
    token,
    `/repos/${owner}/${repo}/git/ref/heads/${branch}`
  )
  return ref.object.sha
}

// ── Step 3: Get the base tree SHA from the HEAD commit ───────────────────────
async function getBaseTreeSha(
  token:     string,
  owner:     string,
  repo:      string,
  commitSha: string
): Promise<string> {
  const commit = await githubFetch<{ tree: { sha: string } }>(
    token,
    `/repos/${owner}/${repo}/git/commits/${commitSha}`
  )
  return commit.tree.sha
}

// ── Step 4: Create a new tree with updated file blobs ────────────────────────
async function createTree(
  token:       string,
  owner:       string,
  repo:        string,
  baseTreeSha: string,
  fileBlobs:   { path: string; sha: string }[]
): Promise<string> {
  const res = await githubFetch<TreeResponse>(
    token,
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: fileBlobs.map(({ path, sha }) => ({
          path,
          mode: '100644',   // normal file
          type: 'blob',
          sha,
        })),
      }),
    }
  )
  return res.sha
}

// ── Step 5: Create the commit object ─────────────────────────────────────────
async function createCommit(
  token:     string,
  owner:     string,
  repo:      string,
  message:   string,
  treeSha:   string,
  parentSha: string
): Promise<string> {
  const res = await githubFetch<CommitResponse>(
    token,
    `/repos/${owner}/${repo}/git/commits`,
    {
      method: 'POST',
      body: JSON.stringify({ message, tree: treeSha, parents: [parentSha] }),
    }
  )
  return res.sha
}

// ── Step 6: Move the branch ref to the new commit ────────────────────────────
async function updateBranchRef(
  token:     string,
  owner:     string,
  repo:      string,
  branch:    string,
  commitSha: string
): Promise<void> {
  await githubFetch(token, `/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commitSha }),
  })
}

// ── Orchestrator — full commit + push flow ────────────────────────────────────
export interface CommitFilesParams {
  token:   string
  owner:   string
  repo:    string
  branch:  string
  files:   CommitFile[]
  message: string
}

export async function commitFiles(params: CommitFilesParams): Promise<string> {
  const { token, owner, repo, branch, files, message } = params

  // 1. Get current HEAD
  const headSha    = await getHeadCommitSha(token, owner, repo, branch)
  const baseTreeSha = await getBaseTreeSha(token, owner, repo, headSha)

  // 2. Create blobs for each file
  const fileBlobs = await Promise.all(
    files.map(async (file) => ({
      path: file.path,
      sha:  await createBlob(token, owner, repo, file.content),
    }))
  )

  // 3. Create new tree
  const newTreeSha = await createTree(token, owner, repo, baseTreeSha, fileBlobs)

  // 4. Create commit
  const commitSha = await createCommit(token, owner, repo, message, newTreeSha, headSha)

  // 5. Update branch ref
  await updateBranchRef(token, owner, repo, branch, commitSha)

  return commitSha
}
