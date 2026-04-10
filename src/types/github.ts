export interface GitHubRepo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  language: string | null
  private: boolean
  default_branch: string
  stargazers_count: number
  fork: boolean
  updated_at: string
  owner: {
    login: string
    avatar_url: string
  }
}

export interface CommitFile {
  path: string
  content: string
}

export interface CommitPayload {
  sessionId: string
  files: CommitFile[]
  userMessage: string
  committerId: string
  repoOwner: string
  repoName: string
}

export interface GitHubFileContent {
  path: string
  content: string
  sha: string
  encoding: 'base64'
  size: number
}

export interface GitHubBranch {
  name: string
  protected: boolean
  commit: {
    sha: string
  }
}
