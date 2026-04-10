// Dev 1 — Presence tracking helpers
// Re-exports from the presence model for convenience
// Full RTDB onDisconnect implementation is Dev 3 territory (TDD §18)

export { setPresence, onPresenceChange, removePresence } from '@/lib/firebase/models/presence'
