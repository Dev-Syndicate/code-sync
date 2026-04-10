import { githubFetch } from './api'
import type { GitHubRepo, GitHubFileContent } from '@/types/github'

// ── List authenticated user's repositories ────────────────────────────────────
export async function fetchUserRepos(token: string): Promise<GitHubRepo[]> {
  // Fetches up to 100 repos, sorted by most recently updated
  return githubFetch<GitHubRepo[]>(token, '/user/repos?per_page=100&sort=updated&type=owner')
}

// ── Fetch flat file list from a repository ────────────────────────────────────
// Returns only files (not directories), recursively from the root tree
export async function fetchRepoFiles(
  token:  string,
  owner:  string,
  repo:   string,
  branch: string = 'main'
): Promise<{ path: string; sha: string; type: string }[]> {
  const branchData = await githubFetch<{ commit: { commit: { tree: { sha: string } } } }>(
    token,
    `/repos/${owner}/${repo}/branches/${branch}`
  )

  const treeSha = branchData.commit.commit.tree.sha

  const treeData = await githubFetch<{
    tree: { path: string; sha: string; type: string }[]
  }>(token, `/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`)

  // Only return blobs (files), not trees (directories)
  return treeData.tree.filter((item) => item.type === 'blob')
}

// ── Fetch a single file's content and SHA ────────────────────────────────────
export async function fetchFileContent(
  token:    string,
  owner:    string,
  repo:     string,
  filePath: string
): Promise<GitHubFileContent> {
  return githubFetch<GitHubFileContent>(
    token,
    `/repos/${owner}/${repo}/contents/${filePath}`
  )
}
