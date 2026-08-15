import { useState, useEffect, useCallback } from 'react';

export function useChromecast() {
  const [isCastAvailable, setIsCastAvailable] = useState(false);
  const [castSession, setCastSession] = useState(null);
  const [castState, setCastState] = useState('NO_DEVICES_AVAILABLE'); // CONNECTED, NOT_CONNECTED, CONNECTING

  useEffect(() => {
    const initializeCastApi = () => {
      const cast = window.cast;
      const chrome = window.chrome;
      
      if (!cast || !chrome || !cast.framework) return;

      try {
        cast.framework.CastContext.getInstance().setOptions({
          receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
          autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED
        });
      } catch (e) {}

      setIsCastAvailable(true);
      
      const context = cast.framework.CastContext.getInstance();
      
      // Ascolta i cambiamenti di stato
      context.addEventListener(
        cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        (event) => {
          setCastState(event.castState);
        }
      );

      // Ascolta le sessioni (se l'utente si è connesso a un chromecast)
      context.addEventListener(
        cast.framework.CastContextEventType.SESSION_STATE_CHANGED,
        (event) => {
          if (event.sessionState === cast.framework.SessionState.SESSION_STARTED || 
              event.sessionState === cast.framework.SessionState.SESSION_RESUMED) {
            setCastSession(context.getCurrentSession());
          } else if (event.sessionState === cast.framework.SessionState.SESSION_ENDED) {
            setCastSession(null);
          }
        }
      );
      
      // Inizializza gli state attuali
      setCastState(context.getCastState());
      setCastSession(context.getCurrentSession());
    };
    
    if (window.isCastApiAvailable) {
      initializeCastApi();
    } else {
      const handleCastAvailable = () => initializeCastApi();
      document.addEventListener('castApiAvailable', handleCastAvailable);
      return () => document.removeEventListener('castApiAvailable', handleCastAvailable);
    }
  }, []);

  const requestSession = useCallback(async () => {
    if (!isCastAvailable) return;
    try {
      await window.cast.framework.CastContext.getInstance().requestSession();
    } catch (e) {
      console.error('Errore durante la richiesta di sessione Cast:', e);
    }
  }, [isCastAvailable]);

  const loadMedia = useCallback(async (videoUrl, title, subtitle, imageUrl) => {
    if (!castSession) return false;
    
    const chrome = window.chrome;
    const mediaInfo = new chrome.cast.media.MediaInfo(videoUrl, 'video/mp4');
    
    const metadata = new chrome.cast.media.GenericMediaMetadata();
    metadata.title = title || 'Video';
    if (subtitle) metadata.subtitle = subtitle;
    if (imageUrl) metadata.images = [new chrome.cast.Image(imageUrl)];
    
    mediaInfo.metadata = metadata;
    
    const request = new chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;

    try {
      await castSession.loadMedia(request);
      return true;
    } catch (error) {
      console.error('Errore durante il caricamento del media su Chromecast:', error);
      return false;
    }
  }, [castSession]);

  return {
    isCastAvailable,
    castState,
    isCasting: castState === 'CONNECTED',
    requestSession,
    loadMedia
  };
}
