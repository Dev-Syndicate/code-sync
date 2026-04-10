// Firebase Admin SDK — server-side only
// Never import this file in client components
import * as admin from 'firebase-admin'

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n')

  return admin.initializeApp({
    credential: admin.credential.cert({
      projectId:   process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey,
    }),
  })
}

const app = initAdmin()

export const adminAuth = admin.auth(app)
export const adminDb   = admin.firestore(app)
