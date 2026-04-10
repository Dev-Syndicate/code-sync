'use client'

import { useEffect, useRef, useCallback } from 'react'
import { db } from '@/lib/firebase/config'
import {
  doc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore'

interface FileEditorTrackingOptions {
  sessionId: string
  userId: string
  username: string
  email: string
  avatar: string
  currentFile: string | null
}

/**
 * Tracks which user is editing which file in Firestore.
 * Debounced to avoid excessive writes (2 second debounce).
 * Updates the `fileEditors` subcollection in the session document.
 */
export function useFileEditorTracking({
  sessionId,
  userId,
  username,
  email,
  avatar,
  currentFile,
}: FileEditorTrackingOptions): void {
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const lastTrackedFile = useRef<string | null>(null)

  const trackFileEdit = useCallback(
    async (filePath: string) => {
      if (!sessionId || !userId || !filePath) return

      try {
        const editorRef = doc(
          db,
          'sessions',
          sessionId,
          'fileEditors',
          `${userId}_${filePath.replace(/\//g, '_')}`
        )

        await setDoc(
          editorRef,
          {
            filename: filePath,
            editors: [
              {
                userId,
                username,
                githubName: username,
                email,
                avatar,
                editedAt: serverTimestamp(),
              },
            ],
          },
          { merge: true }
        )
      } catch (error) {
        // Silently fail — tracking is non-critical
        console.warn('Failed to track file editor:', error)
      }
    },
    [sessionId, userId, username, email, avatar]
  )

  useEffect(() => {
    if (!currentFile || currentFile === lastTrackedFile.current) return

    // Debounce to avoid excessive Firestore writes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      lastTrackedFile.current = currentFile
      trackFileEdit(currentFile)
    }, 2000)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [currentFile, trackFileEdit])
}
