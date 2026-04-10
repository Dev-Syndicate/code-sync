// GitHub REST API — authenticated fetch wrapper
// All GitHub API calls go through this function

const GITHUB_API = 'https://api.github.com'

export class GitHubApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name  = 'GitHubApiError'
    this.status = status
  }
}

export async function githubFetch<T>(
  token:   string,
  path:    string,
  options: RequestInit = {}
): Promise<T> {
  const url = path.startsWith('https://') ? path : `${GITHUB_API}${path}`

  const res = await fetch(url, {
    ...options,
    headers: {
      Accept:        'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new GitHubApiError(
      body?.message ?? `GitHub API error: ${res.status}`,
      res.status
    )
  }

  // 204 No Content — return empty object
  if (res.status === 204) return {} as T

  return res.json() as Promise<T>
}
