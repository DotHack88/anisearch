/**
 * useSession — genera e persiste un ID sessione in localStorage.
 * Usato per il watch progress cross-site (Vercel → Render).
 */
const SESSION_KEY = 'anisearch_session_id'

function generateSessionId() {
  return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  }) + '-' + Date.now().toString(36)
}

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateSessionId()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}
