import React, { useEffect } from 'react';

export default function CastDeviceModal({
  isOpen,
  onClose,
  devices,
  isScanning,
  scanError,
  onScan,
  onSelectDevice,
  castState,
  selectedDevice,
  castError,
  onPause,
  onResume,
  onStop
}) {
  // Auto-scan on open if not scanning and no devices
  useEffect(() => {
    if (isOpen && !isScanning && devices.length === 0 && !scanError) {
      onScan();
    }
  }, [isOpen, isScanning, devices.length, scanError, onScan]);

  if (!isOpen) return null;

  const isPlaying = castState === 'playing' || castState === 'loading';
  const isPaused = castState === 'paused';
  const isActive = isPlaying || isPaused;

  const getDeviceIcon = (type) => {
    switch (type) {
      case 'samsung': return '📺';
      case 'lg': return '🖥️';
      case 'sony': return '🎮';
      case 'philips': return '💡';
      case 'fire': return '🔥';
      case 'apple': return '🍎';
      case 'roku': return '🟣';
      default: return '📺';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-surface/90 border border-border/50 shadow-2xl rounded-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
        
        {/* Header */}
        <div className="p-4 border-b border-border/30 flex justify-between items-center bg-surface">
          <h2 className="text-lg font-bold font-display tracking-wide text-white flex items-center gap-2">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
              <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
              <polyline points="17 2 12 7 7 2"></polyline>
            </svg>
            Trasmetti alla TV
          </h2>
          <button 
            onClick={onClose}
            className="p-1.5 text-text-dim hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          
          {isActive ? (
            // Active Cast View
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mb-4 animate-pulse">
                <span className="text-4xl">{getDeviceIcon(selectedDevice?.type)}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">In riproduzione</h3>
              <p className="text-blue-400 font-semibold">{selectedDevice?.name || 'Smart TV'}</p>
              
              {castError && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {castError}
                </div>
              )}

              <div className="flex gap-3 mt-8">
                {isPlaying ? (
                  <button onClick={onPause} className="px-6 py-2.5 bg-surface border border-border hover:bg-white/5 rounded-xl font-bold flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                    Pausa
                  </button>
                ) : (
                  <button onClick={onResume} className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-blue-500/20">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                    Riprendi
                  </button>
                )}
                <button onClick={onStop} className="px-6 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20 rounded-xl font-bold flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="16" height="16"></rect></svg>
                  Ferma
                </button>
              </div>
            </div>
          ) : (
            // Discovery View
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <p className="text-sm font-semibold text-text-dim">Dispositivi disponibili sulla rete</p>
                <button onClick={onScan} disabled={isScanning} className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1 disabled:opacity-50">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={isScanning ? "animate-spin" : ""}><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                  {isScanning ? 'Ricerca...' : 'Aggiorna'}
                </button>
              </div>

              {scanError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                  {scanError}
                  {scanError.includes("locale") && (
                    <p className="mt-2 text-xs text-red-300/80">
                      Il casting Smart TV funziona solo se il backend AniSearch viene avviato sulla stessa rete Wi-Fi della TV (es. localhost).
                    </p>
                  )}
                </div>
              )}

              {isScanning && devices.length === 0 && !scanError && (
                <div className="py-10 flex flex-col items-center text-text-dim">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin mb-3 text-blue-500"><path d="M21 12a9 9 0 1 1-6.219-8.56"></path></svg>
                  <p>Ricerca Smart TV in corso...</p>
                </div>
              )}

              {!isScanning && devices.length === 0 && !scanError && (
                <div className="py-8 text-center text-text-dim bg-white/5 rounded-xl border border-border/50">
                  <p className="mb-2">Nessun dispositivo compatibile trovato.</p>
                  <p className="text-xs max-w-[250px] mx-auto text-text-dim/70">
                    Se hai una Fire Stick, installa l'app <b>AirScreen</b> per renderla visibile.
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {devices.map((device, i) => (
                  <button
                    key={device.id || i}
                    onClick={() => onSelectDevice(device)}
                    className="w-full text-left p-3 rounded-xl bg-surface border border-border hover:border-blue-500/50 hover:bg-blue-500/10 transition-all flex items-center gap-3 group"
                  >
                    <span className="text-2xl opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-transform">
                      {getDeviceIcon(device.type)}
                    </span>
                    <div className="flex-1 overflow-hidden">
                      <div className="font-bold text-white truncate">{device.name}</div>
                      <div className="text-xs text-text-dim truncate">{device.manufacturer} {device.model}</div>
                    </div>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                ))}
              </div>
              
              <div className="mt-6 p-3 bg-white/5 rounded-lg text-xs text-text-dim/70">
                <p><b>Note compatibilità:</b> Supporta nativamente TV Samsung, LG, Sony e Philips. Per Amazon Fire Stick è necessario aprire l'app gratuita "AirScreen" prima di trasmettere.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
