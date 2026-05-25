import { useState, useEffect, useCallback } from 'react'
import {
  initDownloadManager,
  subscribeToDownloads,
  startDownload,
  cancelDownload,
  removeDownloadedEpisode,
  getDownloadedVideoUrl
} from '../utils/downloadManager.js'

export function useDownloads() {
  const [downloads, setDownloads] = useState([])
  
  useEffect(() => {
    initDownloadManager();
    const unsubscribe = subscribeToDownloads((state) => {
      setDownloads(state);
    });
    return unsubscribe;
  }, [])

  const getEpisodeDownload = useCallback((episodeId) => {
    return downloads.find(d => d.episodeId === episodeId)
  }, [downloads])

  const isDownloaded = useCallback((episodeId) => {
    const d = getEpisodeDownload(episodeId);
    return d ? d.status === 'completed' : false;
  }, [getEpisodeDownload])

  const isDownloading = useCallback((episodeId) => {
    const d = getEpisodeDownload(episodeId);
    return d ? d.status === 'downloading' : false;
  }, [getEpisodeDownload])

  const getProgress = useCallback((episodeId) => {
    const d = getEpisodeDownload(episodeId);
    return d ? d.progress : 0;
  }, [getEpisodeDownload])

  const handleStartDownload = useCallback((animeId, animeTitle, animeImage, episodeId, episodeNumber) => {
    startDownload(animeId, animeTitle, animeImage, episodeId, episodeNumber);
  }, [])

  const handleCancelDownload = useCallback((episodeId) => {
    cancelDownload(episodeId);
  }, [])

  const handleRemoveDownload = useCallback((episodeId) => {
    removeDownloadedEpisode(episodeId);
  }, [])

  const getOfflineUrl = useCallback(async (episodeId) => {
    return await getDownloadedVideoUrl(episodeId);
  }, [])

  const activeCount = downloads.filter(d => d.status === 'downloading').length;

  return {
    downloads,
    getEpisodeDownload,
    isDownloaded,
    isDownloading,
    getProgress,
    startDownload: handleStartDownload,
    cancelDownload: handleCancelDownload,
    removeDownload: handleRemoveDownload,
    getOfflineUrl,
    activeCount
  }
}
