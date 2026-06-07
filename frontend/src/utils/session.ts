/**
 * Session management — genera e persiste un ID sessione in localStorage.
 * Lo stesso ID viene usato come chiave per cronologia, preferiti e progresso.
 * Condividendo questo codice tra dispositivi si sincronizza l'intero profilo.
 */
const SESSION_KEY = 'anisearch_session_id'

function generateSessionId() {
  const rand = () => Math.random().toString(36).slice(2, 7).toUpperCase()
  return `${rand()}-${rand()}-${rand()}`  // es. "X4K2A-9RTZP-WB1QE"
}

export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = generateSessionId()
    localStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/** Sostituisce l'ID corrente con uno importato da un altro dispositivo. */
export function importSessionId(newId: string): void {
  const clean = newId.trim()
  if (!clean) throw new Error('Codice non valido')
  localStorage.setItem(SESSION_KEY, clean)
  // Forza il reload per applicare il nuovo session_id a tutte le API
  window.location.reload()
}

/** Ritorna il codice formattato per la visualizzazione. */
export function getDisplayCode(): string {
  return getSessionId()
}
