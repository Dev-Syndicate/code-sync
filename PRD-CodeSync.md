# Product Requirements Document (PRD)
## CodeSync — Collaborative Coding Platform for Students

**Version:** 1.0  
**Status:** Draft  
**Project Code:** SE003  
**Date:** April 2026  

---

## 1. Overview

### 1.1 Problem Statement
Group coding projects are difficult because students cannot easily collaborate in real time. Working across different machines, managing Git conflicts manually, and communicating via separate tools creates friction that slows down development and learning.

### 1.2 Solution
CodeSync is a web-based collaborative coding platform where multiple students can write code together in real time inside a shared session, linked directly to their GitHub repositories. Think of it as Google Docs — but for code, with GitHub integration built in.

### 1.3 Vision
Enable any student to open their GitHub repo, start a session, share a link, and immediately begin coding live with teammates — with zero setup and no merge headaches during the session.

---

## 2. Goals & Success Metrics

### 2.1 Goals
- Allow multiple users to edit code simultaneously without conflicts
- Integrate directly with GitHub for version control (load, commit, push)
- Provide a familiar VS Code-like editing experience in the browser
- Keep the platform simple enough to use in a hackathon or classroom setting

### 2.2 Success Metrics
- A session can be created and joined within 30 seconds
- Real-time sync latency under 100ms for collaborators
- Commits and pushes to GitHub succeed without data loss
- The platform works for 2–4 concurrent users per session in MVP

---

## 3. Users

### 3.1 Primary User
**Students** working on group coding projects who have a GitHub account and basic coding knowledge.

### 3.2 User Roles

| Role | Description |
|---|---|
| Session Owner | Creates the session, loads the repo, can commit and push |
| Collaborator | Joins via shared link, can edit code and chat |

---

## 4. Features

### 4.1 MVP Features (Must Have)

#### Authentication
- Login with GitHub OAuth only
- User profile (name, avatar, GitHub username) stored in Firebase
- Session persists across browser refresh

#### Repo Selection
- After login, user sees a list of their GitHub repositories
- Click any repo to load its files
- Session is auto-created on repo selection

#### Session System
- Auto-generated unique Session ID (UUID)
- Shareable link: `yourapp.com/session/{sessionId}`
- Session data stored in Firebase Firestore
- Participants list shows who is currently in the session
- Session owner can close the session

#### Live Code Editor
- Monaco Editor (VS Code engine) in the browser
- File tree sidebar showing repo files
- Tab-based multi-file editing
- Syntax highlighting for common languages
- Real-time collaborative editing powered by Yjs + WebRTC
- Live cursor presence — see where teammates are editing

#### Real-Time Collaboration
- All changes sync instantly across all participants
- Conflict-free merging via Yjs CRDT engine
- No two users can create a conflicting edit — Yjs handles it automatically
- Participant joins and leaves are reflected in real time

#### Chat
- In-session team chat panel
- Messages stored in Firebase Firestore
- Tied to the session — chat history visible to all participants

#### Auto-Save (Draft)
- Code auto-saved to Firebase Storage every 2 minutes
- Protects against browser crash or accidental close
- Draft is deleted after a successful commit

#### Commit & Push to GitHub
- Session owner clicks "Commit & Push"
- Writes a commit message
- Changes are committed to the GitHub repo via Next.js API
- Uses the owner's GitHub access token securely (server-side only)

### 4.2 Post-MVP Features (Nice to Have)

| Feature | Description |
|---|---|
| Code execution | Run code in browser via WebContainers or Docker |
| AI assistant | In-editor AI suggestions via OpenAI / Claude API |
| Voice/video | WebRTC media streams for voice chat |
| Session history | Replay who typed what and when |
| File upload | Add new files to session from local machine |

---

## 5. User Flows

### 5.1 Create a Session
```
1. User visits the app
2. Clicks "Login with GitHub"
3. GitHub OAuth redirects to callback
4. User details saved to Firestore
5. User lands on Dashboard
6. User sees list of their repos
7. User clicks a repo
8. App loads repo files from GitHub API
9. Session auto-created with unique ID
10. User sees shareable link
11. Editor opens with repo files loaded
```

### 5.2 Join a Session
```
1. Friend receives session link
2. Friend opens the link
3. If not logged in → GitHub OAuth login
4. Added to session participants
5. Repo files load in their editor
6. Live sync begins instantly
```

### 5.3 Commit & Push
```
1. Session owner clicks "Commit & Push"
2. Modal opens asking for commit message
3. Owner types message and confirms
4. Next.js API receives request
5. GitHub API called with stored token
6. Code committed to repo on GitHub
7. Success notification shown
8. Auto-save draft deleted
```

---

## 6. Out of Scope (MVP)
- Mobile app
- Private/organisation repositories (MVP: public repos only, expand later)
- Multiple branches within a session
- Code review / pull request creation
- Offline mode

---

## 7. Timeline (Suggested)

| Week | Milestone |
|---|---|
| Week 1 | Project setup, Firebase config, GitHub OAuth (Dev 1) |
| Week 1 | Dashboard + Repo list UI (Dev 2) |
| Week 2 | Session creation logic + Editor scaffold (Dev 3) |
| Week 2 | API routes for GitHub commits (Dev 4) |
| Week 3 | Yjs + WebRTC collaboration integration (Dev 3) |
| Week 3 | Chat system + Presence (Dev 4) |
| Week 4 | Auto-save + Polish + Testing |
| Week 4 | Deploy to Vercel + Demo |

---

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| WebRTC fails behind firewall | Users cannot sync | Add TURN server for production |
| GitHub token exposed | Security breach | Token only in server-side API routes |
| Yjs sync desync | Code corruption | Test with 4 concurrent users before demo |
| Firebase costs | Over budget | Use Spark (free) plan for MVP |
