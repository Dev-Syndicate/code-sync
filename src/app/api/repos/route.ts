// GET /api/repos
// Returns the authenticated user's GitHub repositories.
//
// Optional query params:
//   ?owner=<login>&repo=<name>&path=<filepath>
//     → Returns a single file's content (for editor file loading)

import { type NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api/response'
import { getAuthContext, getGitHubToken } from '@/lib/api/auth'
import {
  fetchUserRepos,
  fetchFileContent,
  fetchRepoBranches,
} from '@/lib/github/repos'
import { GitHubApiError } from '@/lib/github/api'

export async function GET(req: NextRequest) {
  // 1. Verify session
  let uid: string
  try {
    const ctx = await getAuthContext(req)
    uid = ctx.uid
  } catch (err) {
    const code = err instanceof Error ? err.message : 'AUTH_REQUIRED'
    const status = code === 'AUTH_EXPIRED' ? 401 : 401
    return apiError(code, 'Authentication required.', status)
  }

  // 2. Get GitHub token
  let token: string
  try {
    token = await getGitHubToken(uid)
  } catch (err) {
    console.error('[GET /api/repos] getGitHubToken failed for uid', uid, err)
    return apiError('GITHUB_ERROR', 'GitHub token not found. Please sign in again.', 401)
  }

  // 3. Check for file content / branches request
  const { searchParams } = req.nextUrl
  const owner    = searchParams.get('owner')
  const repo     = searchParams.get('repo')
  const filePath = searchParams.get('path')
  const branchesMode = searchParams.get('branches') === '1'

  if (owner && repo && filePath) {
    // File content mode
    try {
      const file = await fetchFileContent(token, owner, repo, filePath)
      return apiSuccess(file)
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) {
        return apiError('NOT_FOUND', `File "${filePath}" not found.`, 404)
      }
      return apiError('GITHUB_ERROR', 'Failed to fetch file content.', 502)
    }
  }

  if (owner && repo && branchesMode) {
    // Branch list mode — used by the Create Session modal and the
    // session header branch dropdown.
    try {
      const branches = await fetchRepoBranches(token, owner, repo)
      return apiSuccess(branches)
    } catch (err) {
      if (err instanceof GitHubApiError && err.status === 404) {
        return apiError('NOT_FOUND', `Repository "${owner}/${repo}" not found.`, 404)
      }
      return apiError('GITHUB_ERROR', 'Failed to fetch branches.', 502)
    }
  }

  // 4. Repo list mode
  try {
    const repos = await fetchUserRepos(token)
    return apiSuccess(repos)
  } catch (err) {
    if (err instanceof GitHubApiError) {
      return apiError('GITHUB_ERROR', err.message, 502)
    }
    return apiError('INTERNAL_ERROR', 'Failed to fetch repositories.', 500)
  }
}
