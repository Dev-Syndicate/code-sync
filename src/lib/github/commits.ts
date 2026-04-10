// GitHub Git Tree API — full commit flow
// Creates blobs → tree → commit → updates branch ref

import { GitHubApiError, githubFetch } from './api'
import type { CommitFile } from '@/types/github'

interface BlobResponse   { sha: string }
interface TreeResponse   { sha: string }
interface CommitResponse { sha: string }
interface RefResponse    { object: { sha: string } }

// ── Shapes for the listing + revert flows ────────────────────────────────────
// Trimmed to just the fields we care about — the GitHub REST responses are
// much larger, but we can't import them from a typedef so we project.
export interface GitHubCommitSummary {
  sha:     string
  message: string
  author:  {
    name:  string
    email: string
    date:  string
  }
  /** Login of the GitHub user who authored the commit, if GitHub was able to
   *  resolve one from the email. Null for generic author emails. */
  authorLogin: string | null
  /** Avatar URL of the GitHub user, if known. */
  authorAvatar: string | null
  /** Parent commit SHAs. Merge commits have >1. */
  parents: string[]
}

interface RawCommitListResponse {
  sha: string
  commit: {
    message: string
    author: { name: string; email: string; date: string }
  }
  author: { login: string; avatar_url: string } | null
  parents: { sha: string }[]
}

interface RawTreeEntry {
  path: string
  mode: string
  type: 'blob' | 'tree' | 'commit'
  sha:  string
}

interface RawTreeResponse {
  sha:  string
  tree: RawTreeEntry[]
  truncated: boolean
}

interface RawCommitDetailResponse {
  sha: string
  message: string
  author: { name: string; email: string; date: string }
  tree:   { sha: string }
  parents: { sha: string }[]
}

interface RawBlobResponse {
  content:  string
  encoding: 'base64' | 'utf-8'
}

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

// ─────────────────────────────────────────────────────────────────────────────
// Listing commits on a branch
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns the latest N commits on a branch, newest first.
 *
 * We use /repos/{o}/{r}/commits with ?sha={branch} because that endpoint
 * returns the commit log reachable from that ref — i.e. `git log branch`.
 * The simpler /git/commits endpoint doesn't take a branch parameter.
 */
export async function listCommits(
  token:   string,
  owner:   string,
  repo:    string,
  branch:  string,
  perPage: number = 30,
): Promise<GitHubCommitSummary[]> {
  const raw = await githubFetch<RawCommitListResponse[]>(
    token,
    `/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=${perPage}`,
  )

  return raw.map((c) => ({
    sha:          c.sha,
    message:      c.commit.message,
    author:       c.commit.author,
    authorLogin:  c.author?.login ?? null,
    authorAvatar: c.author?.avatar_url ?? null,
    parents:      c.parents.map((p) => p.sha),
  }))
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverting a commit (inverse-commit flow)
// ─────────────────────────────────────────────────────────────────────────────

export class RevertConflictError extends Error {
  conflictingFiles: string[]
  constructor(conflictingFiles: string[]) {
    super(
      `Cannot revert: the following files have been modified by later commits: ${conflictingFiles.join(
        ', ',
      )}`,
    )
    this.name = 'RevertConflictError'
    this.conflictingFiles = conflictingFiles
  }
}

async function getCommitDetail(
  token:     string,
  owner:     string,
  repo:      string,
  commitSha: string,
): Promise<RawCommitDetailResponse> {
  return githubFetch<RawCommitDetailResponse>(
    token,
    `/repos/${owner}/${repo}/git/commits/${commitSha}`,
  )
}

async function getRecursiveTree(
  token:   string,
  owner:   string,
  repo:    string,
  treeSha: string,
): Promise<Map<string, string>> {
  const res = await githubFetch<RawTreeResponse>(
    token,
    `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
  )
  if (res.truncated) {
    throw new GitHubApiError(
      'Repository tree is too large to revert safely (GitHub truncated the response).',
      500,
    )
  }
  const byPath = new Map<string, string>()
  for (const entry of res.tree) {
    // Only blobs are files we care about. Trees are directories (implicit),
    // commits are submodules (we can't revert those from the REST API).
    if (entry.type === 'blob') byPath.set(entry.path, entry.sha)
  }
  return byPath
}

async function getBlobContent(
  token: string,
  owner: string,
  repo:  string,
  sha:   string,
): Promise<string> {
  const res = await githubFetch<RawBlobResponse>(
    token,
    `/repos/${owner}/${repo}/git/blobs/${sha}`,
  )
  if (res.encoding === 'base64') {
    return Buffer.from(res.content, 'base64').toString('utf-8')
  }
  return res.content
}

/**
 * Result of a successful revert. Includes the new commit sha and the list
 * of files the revert touched, so the caller can reset in-session Y.Texts
 * for those files.
 */
export interface RevertResult {
  commitSha:     string
  affectedFiles: Array<{
    path:      string
    /** 'modify' means the file existed before and after; 'delete' means the
     *  reverted commit created the file, so the revert deletes it; 'create'
     *  means the reverted commit deleted the file, so the revert restores it. */
    operation: 'modify' | 'delete' | 'create'
    /** Post-revert file contents. Null for 'delete' operations. */
    content:   string | null
  }>
}

export interface RevertCommitParams {
  token:        string
  owner:        string
  repo:         string
  branch:       string
  /** The commit to revert (the one whose changes should be undone). */
  targetSha:    string
  /** Commit message to use for the new inverse commit. */
  message:      string
}

/**
 * Reverts a commit by creating a new "inverse" commit on top of HEAD — the
 * same behavior as `git revert`. Does NOT force-push or rewrite history.
 *
 * The algorithm:
 *
 *  1. Fetch the target commit X and its parent P. Both have tree SHAs.
 *  2. Fetch X's tree and P's tree recursively (flat path → blob-sha maps).
 *  3. Diff them — every path whose blob-sha differs between P and X is a
 *     file that X changed. That's the set we need to revert.
 *  4. Fetch HEAD's tree (which may be ahead of X). **Conflict check:** for
 *     every file X changed, HEAD's blob-sha for that path must equal X's
 *     blob-sha. If any don't match, a later commit has modified the same
 *     file and we refuse with RevertConflictError. The branch is unchanged.
 *  5. For clean files, fetch the pre-X blob content (from P's tree) — that's
 *     what we want to put back. Files X added (no entry in P) get deleted.
 *     Files X deleted (no entry in X, but in P) get restored.
 *  6. Build a new tree on top of HEAD's tree, commit it with the caller's
 *     message, and move the branch ref forward. One new commit, no force.
 *
 * Returns the new commit sha AND the post-revert contents of every touched
 * file so the caller can reset in-session Y.Texts collaboratively.
 */
export async function revertCommit(params: RevertCommitParams): Promise<RevertResult> {
  const { token, owner, repo, branch, targetSha, message } = params

  // Step 1 — target commit + parent. We only support non-merge commits.
  const targetCommit = await getCommitDetail(token, owner, repo, targetSha)
  if (targetCommit.parents.length === 0) {
    throw new GitHubApiError('Cannot revert the initial commit of the repository.', 400)
  }
  if (targetCommit.parents.length > 1) {
    // Merge commits require picking a -m mainline — we don't support that
    // here, and it's a footgun in a GUI with no mainline picker.
    throw new GitHubApiError(
      'Cannot revert a merge commit. Revert individual commits on the merged branch instead.',
      400,
    )
  }
  const parentSha    = targetCommit.parents[0].sha
  const parentCommit = await getCommitDetail(token, owner, repo, parentSha)

  // Step 2 — recursive flat trees for X and P.
  const [xTree, pTree, headSha] = await Promise.all([
    getRecursiveTree(token, owner, repo, targetCommit.tree.sha),
    getRecursiveTree(token, owner, repo, parentCommit.tree.sha),
    getHeadCommitSha(token, owner, repo, branch),
  ])

  // Step 3 — changedFiles = paths where X differs from P.
  const changed: Array<{
    path:      string
    xSha:      string | null   // blob sha in X (null if X deleted it)
    pSha:      string | null   // blob sha in P (null if X added it)
    operation: 'modify' | 'delete' | 'create'
  }> = []

  const allPaths = new Set<string>([...xTree.keys(), ...pTree.keys()])
  for (const path of allPaths) {
    const xSha = xTree.get(path) ?? null
    const pSha = pTree.get(path) ?? null
    if (xSha === pSha) continue
    let operation: 'modify' | 'delete' | 'create'
    if (xSha && !pSha) operation = 'delete'      // X added — revert = delete
    else if (!xSha && pSha) operation = 'create' // X deleted — revert = restore
    else operation = 'modify'                    // X changed — revert = restore old
    changed.push({ path, xSha, pSha, operation })
  }

  if (changed.length === 0) {
    throw new GitHubApiError('Nothing to revert — this commit did not change any files.', 400)
  }

  // Step 4 — fetch HEAD's tree and do the conflict check.
  const headCommit = await getCommitDetail(token, owner, repo, headSha)
  const headTree   = await getRecursiveTree(token, owner, repo, headCommit.tree.sha)

  const conflicts: string[] = []
  for (const { path, xSha } of changed) {
    const headBlobSha = headTree.get(path) ?? null
    if (headBlobSha !== xSha) {
      conflicts.push(path)
    }
  }
  if (conflicts.length > 0) {
    throw new RevertConflictError(conflicts)
  }

  // Step 5 — fetch pre-X blob content for every file we need to restore,
  // and decide what to put into the new tree.
  //
  // For 'modify' and 'create' operations, we need the blob content from P.
  // For 'delete' operations, we just write a null tree entry, which
  // GitHub interprets as "remove this path."
  const affectedFiles: RevertResult['affectedFiles'] = []
  const newTreeEntries: Array<{
    path:    string
    mode:    '100644'
    type:    'blob'
    sha?:    string | null
    content?: string
  }> = []

  for (const { path, pSha, operation } of changed) {
    if (operation === 'delete') {
      // X added this file — revert means delete it. Tree sha=null deletes.
      newTreeEntries.push({ path, mode: '100644', type: 'blob', sha: null })
      affectedFiles.push({ path, operation, content: null })
      continue
    }

    // 'modify' or 'create' — restore pSha's content.
    if (!pSha) {
      // Shouldn't happen given how we built `changed`, but guard anyway.
      continue
    }
    const content = await getBlobContent(token, owner, repo, pSha)
    // Inline the content; createTree below will base64 it via createBlob.
    // We take the simpler path and let GitHub create a blob from content
    // string directly by passing it through our existing createBlob helper.
    const newBlobSha = await createBlob(token, owner, repo, content)
    newTreeEntries.push({ path, mode: '100644', type: 'blob', sha: newBlobSha })
    affectedFiles.push({ path, operation, content })
  }

  // Step 6 — build tree on top of HEAD's tree, commit, update ref.
  const newTree = await githubFetch<TreeResponse>(
    token,
    `/repos/${owner}/${repo}/git/trees`,
    {
      method: 'POST',
      body: JSON.stringify({
        base_tree: headCommit.tree.sha,
        tree: newTreeEntries,
      }),
    },
  )

  const newCommitSha = await createCommit(
    token,
    owner,
    repo,
    message,
    newTree.sha,
    headSha,
  )

  await updateBranchRef(token, owner, repo, branch, newCommitSha)

  return { commitSha: newCommitSha, affectedFiles }
}
