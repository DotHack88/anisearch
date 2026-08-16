import { useState, useCallback, useRef } from 'react';
import { getCastDevices, castPlay, castPause, castStop, getCastStatus } from '../utils/api';

/**
 * useDLNA — Hook for Smart TV casting via DLNA/UPnP.
 *
 * Works only when the backend runs on the same LAN as the TVs.
 * Supports: Samsung, LG, Sony, Philips, Fire Stick (with AirScreen app), any DLNA renderer.
 */
export function useDLNA() {
  const [devices, setDevices] = useState([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState(null);

  const [selectedDevice, setSelectedDevice] = useState(null);
  const [castState, setCastState] = useState('idle'); // idle | playing | paused | stopped | error
  const [castError, setCastError] = useState(null);

  const statusPollRef = useRef(null);

  // ── Discovery ──────────────────────────────────────────────────────────────

  const scanDevices = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    setDevices([]);
    try {
      const result = await getCastDevices();
      setDevices(result.devices || []);
      if ((result.devices || []).length === 0) {
        setScanError('Nessun dispositivo trovato. Assicurati che la TV sia accesa e sulla stessa rete Wi-Fi.');
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Scansione fallita. Il backend deve girare in rete locale.';
      setScanError(msg);
    } finally {
      setIsScanning(false);
    }
  }, []);

  // ── Status polling ─────────────────────────────────────────────────────────

  const _startStatusPoll = useCallback((device) => {
    _stopStatusPoll();
    statusPollRef.current = setInterval(async () => {
      try {
        const { state } = await getCastStatus(device.device_url);
        if (state === 'PLAYING') setCastState('playing');
        else if (state === 'PAUSED_PLAYBACK') setCastState('paused');
        else if (state === 'STOPPED' || state === 'NO_MEDIA_PRESENT') {
          setCastState('stopped');
          _stopStatusPoll();
        }
      } catch {
        // silently ignore poll errors
      }
    }, 8000);
  }, []);

  const _stopStatusPoll = useCallback(() => {
    if (statusPollRef.current) {
      clearInterval(statusPollRef.current);
      statusPollRef.current = null;
    }
  }, []);

  // ── Playback control ───────────────────────────────────────────────────────

  const castToDevice = useCallback(async (device, videoUrl, title, imageUrl = '') => {
    setCastError(null);
    setCastState('loading');
    setSelectedDevice(device);
    try {
      await castPlay(device.device_url, videoUrl, title, imageUrl);
      setCastState('playing');
      _startStatusPoll(device);
      return true;
    } catch (err) {
      const msg = err?.response?.data?.detail || 'Impossibile avviare la riproduzione sulla TV.';
      setCastError(msg);
      setCastState('error');
      return false;
    }
  }, [_startStatusPoll]);

  const pauseDLNA = useCallback(async () => {
    if (!selectedDevice) return;
    try {
      await castPause(selectedDevice.device_url);
      setCastState('paused');
    } catch (err) {
      setCastError('Impossibile mettere in pausa.');
    }
  }, [selectedDevice]);

  const resumeDLNA = useCallback(async () => {
    if (!selectedDevice) return;
    // DLNA Play after Pause resumes at the same position
    try {
      await castPlay(selectedDevice.device_url, '', '', '');
      setCastState('playing');
    } catch {
      // fallback: just set state optimistically
      setCastState('playing');
    }
  }, [selectedDevice]);

  const stopDLNA = useCallback(async () => {
    if (!selectedDevice) return;
    _stopStatusPoll();
    try {
      await castStop(selectedDevice.device_url);
    } catch {
      // ignore stop errors
    }
    setCastState('idle');
    setSelectedDevice(null);
  }, [selectedDevice, _stopStatusPoll]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isCasting = castState === 'playing' || castState === 'paused' || castState === 'loading';

  return {
    // Discovery
    devices,
    isScanning,
    scanError,
    scanDevices,

    // Casting state
    selectedDevice,
    castState,
    castError,
    isCasting,

    // Controls
    castToDevice,
    pauseDLNA,
    resumeDLNA,
    stopDLNA,
  };
}
