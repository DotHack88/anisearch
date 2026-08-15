import { useState, useEffect, useRef, useCallback } from 'react'

const WS_BASE = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  .replace(/^http/, 'ws')

// ─── Icons ───────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/>
  </svg>
)
const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)
const CrownIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-3 h-3 text-yellow-400">
    <path d="M2 19h20v2H2zM2 5l5 7 5-7 5 7 5-7v12H2z"/>
  </svg>
)
const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)

/**
 * WatchPartyPanel
 * 
 * Props:
 *  - roomId: string | null  — null means not in a party
 *  - isHost: boolean
 *  - animeId, episodeId, animeTitle, episodeTitle
 *  - sessionId: string
 *  - nickname: string
 *  - videoRef: ref to the <video> element (for host control)
 *  - onClose: () => void
 *  - onSync: (time, isPlaying) => void  — called when server sends sync/seek
 */
export default function WatchPartyPanel({
  roomId,
  isHost,
  sessionId,
  nickname,
  videoRef,
  onClose,
  onSync,
}) {
  const [messages, setMessages] = useState([])
  const [members, setMembers] = useState([])
  const [input, setInput] = useState('')
  const [connected, setConnected] = useState(false)
  const [copied, setCopied] = useState(false)
  const wsRef = useRef(null)
  const messagesEndRef = useRef(null)
  const pingIntervalRef = useRef(null)

  const partyUrl = `${window.location.origin}${window.location.pathname}?party=${roomId}`

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // WebSocket connection
  useEffect(() => {
    if (!roomId || !sessionId) return

    const ws = new WebSocket(
      `${WS_BASE}/party/${roomId}/ws?session_id=${encodeURIComponent(sessionId)}&nickname=${encodeURIComponent(nickname)}`
    )
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      // Keepalive ping every 25s
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'ping' }))
      }, 25000)
    }

    ws.onclose = () => {
      setConnected(false)
      clearInterval(pingIntervalRef.current)
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleServerMessage(data)
      } catch {}
    }

    return () => {
      clearInterval(pingIntervalRef.current)
      ws.close()
    }
  }, [roomId, sessionId])

  // Host: send player events to room
  const sendPlay = useCallback((time) => {
    if (!isHost || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'play', time }))
  }, [isHost])

  const sendPause = useCallback((time) => {
    if (!isHost || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'pause', time }))
  }, [isHost])

  const sendSeek = useCallback((time) => {
    if (!isHost || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'seek', time }))
  }, [isHost])

  // Expose host controls to parent via videoRef event listeners
  useEffect(() => {
    if (!isHost || !videoRef?.current) return
    const video = videoRef.current

    const onPlay = () => sendPlay(video.currentTime)
    const onPause = () => sendPause(video.currentTime)
    const onSeeked = () => sendSeek(video.currentTime)

    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('seeked', onSeeked)
    return () => {
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('seeked', onSeeked)
    }
  }, [isHost, videoRef, sendPlay, sendPause, sendSeek])

  const addSystemMessage = (text) => {
    setMessages(prev => [...prev, { type: 'system', text, id: Date.now() + Math.random() }])
  }

  const handleServerMessage = (data) => {
    switch (data.type) {
      case 'sync':
        setMembers(data.members || [])
        if (onSync && !isHost) onSync(data.time, data.is_playing)
        break

      case 'joined':
        setMembers(data.members || [])
        addSystemMessage(`${data.nickname} si è unito alla stanza 🎉`)
        break

      case 'left':
        setMembers(data.members || [])
        addSystemMessage(`${data.nickname} ha lasciato la stanza`)
        break

      case 'host_changed':
        setMembers(data.members || [])
        const newHostMember = (data.members || []).find(m => m.id === data.new_host)
        addSystemMessage(`👑 ${newHostMember?.nickname || 'Ospite'} è ora l'host`)
        break

      case 'play':
        if (!isHost && videoRef?.current) {
          videoRef.current.currentTime = data.time
          videoRef.current.play().catch(() => {
             videoRef.current.muted = true
             videoRef.current.play().catch(()=>{})
          })
        }
        break

      case 'pause':
        if (!isHost && videoRef?.current) {
          videoRef.current.currentTime = data.time
          videoRef.current.pause()
        }
        break

      case 'seek':
        if (!isHost && videoRef?.current) {
          videoRef.current.currentTime = data.time
        }
        break

      case 'chat':
        setMessages(prev => [...prev, {
          type: 'chat',
          id: Date.now() + Math.random(),
          nickname: data.nickname,
          text: data.text,
          isSelf: data.session_id === sessionId
        }])
        break

      default:
        break
    }
  }

  const sendChat = (e) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    wsRef.current.send(JSON.stringify({ type: 'chat', text }))
    setInput('')
  }

  const copyLink = () => {
    navigator.clipboard.writeText(partyUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full bg-[#0f0f1a] border-l border-white/10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <UsersIcon />
          <span className="font-semibold text-sm text-white">Watch Party</span>
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${connected ? 'bg-green-400' : 'bg-red-500'}`} />
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* Invite Link */}
      <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
        <p className="text-[10px] text-white/40 mb-1.5 uppercase tracking-wider">Link invito</p>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-white/5 rounded-lg px-3 py-1.5 text-xs text-white/60 font-mono truncate">
            {`?party=${roomId}`}
          </div>
          <button
            onClick={copyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0 ${
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-accent/20 text-accent hover:bg-accent/30 border border-accent/30'
            }`}
          >
            <CopyIcon />
            {copied ? 'Copiato!' : 'Copia'}
          </button>
        </div>
      </div>

      {/* Members */}
      <div className="px-4 py-3 border-b border-white/10 flex-shrink-0">
        <p className="text-[10px] text-white/40 mb-2 uppercase tracking-wider">
          Partecipanti ({members.length})
        </p>
        <div className="flex flex-wrap gap-2">
          {members.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-1.5 bg-white/5 rounded-lg px-2.5 py-1"
            >
              {m.is_host && <CrownIcon />}
              <span className={`text-xs ${m.id === sessionId ? 'text-accent font-semibold' : 'text-white/70'}`}>
                {m.nickname}
                {m.id === sessionId && ' (tu)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Host notice */}
      {!isHost && (
        <div className="mx-4 mt-3 px-3 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex-shrink-0">
          <p className="text-[11px] text-yellow-300/80">
            🎬 Solo l'host controlla la riproduzione. Il tuo player è sincronizzato automaticamente.
          </p>
        </div>
      )}

      {/* Chat */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-0">
        {messages.length === 0 && (
          <p className="text-center text-white/30 text-xs mt-4">
            Nessun messaggio ancora…<br />Di' qualcosa!
          </p>
        )}
        {messages.map(msg => (
          <div key={msg.id}>
            {msg.type === 'system' ? (
              <p className="text-center text-[10px] text-white/30 italic py-0.5">{msg.text}</p>
            ) : (
              <div className={`flex flex-col ${msg.isSelf ? 'items-end' : 'items-start'}`}>
                {!msg.isSelf && (
                  <span className="text-[10px] text-white/40 mb-0.5 ml-1">{msg.nickname}</span>
                )}
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs break-words ${
                  msg.isSelf
                    ? 'bg-accent/80 text-white rounded-br-sm'
                    : 'bg-white/10 text-white/90 rounded-bl-sm'
                }`}>
                  {msg.text}
                </div>
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      <form onSubmit={sendChat} className="px-3 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Scrivi un messaggio…"
            maxLength={300}
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-white/30 focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || !connected}
            className="p-2 bg-accent rounded-xl text-white disabled:opacity-40 hover:bg-accent/80 transition-colors flex-shrink-0"
          >
            <SendIcon />
          </button>
        </div>
      </form>
    </div>
  )
}
