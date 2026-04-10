// Firebase Admin SDK — server-side only
// Never import this file in client components
import * as admin from 'firebase-admin'

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!
  }

  if (!process.env.FIREBASE_ADMIN_PROJECT_ID) {
    // Avoid crashing the Next.js build if env vars aren't loaded yet
    return admin.initializeApp({ projectId: 'demo-project' })
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const projectId  = process.env.FIREBASE_ADMIN_PROJECT_ID
  const storageBucket =
    process.env.FIREBASE_ADMIN_STORAGE_BUCKET ?? `${projectId}.appspot.com`

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket,
  })
}

const app = initAdmin()

export const adminAuth    = admin.auth(app)
export const adminDb      = admin.firestore(app)
export const adminStorage = admin.storage(app)
