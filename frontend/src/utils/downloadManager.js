import axios from 'axios';
import { getDownload, saveDownload, deleteDownload, getAllDownloads } from './db.js';

const listeners = new Set();
const activeDownloads = new Map(); // episodeId -> AbortController

let downloadsState = [];
let isInitialized = false;

function notifyListeners() {
  listeners.forEach(l => l([...downloadsState]));
}

export async function initDownloadManager() {
  if (isInitialized) return downloadsState;
  try {
    const stored = await getAllDownloads();
    // Clean up any tasks that were interrupted (stuck in 'downloading' status)
    downloadsState = stored.map(d => {
      if (d.status === 'downloading') {
        return { ...d, status: 'failed', progress: 0 };
      }
      return d;
    });
    // Write corrected failed status back to IndexedDB
    for (const d of downloadsState) {
      if (d.status === 'failed') {
        await saveDownload(d);
      }
    }
    isInitialized = true;
    notifyListeners();
  } catch (e) {
    console.error("Failed to initialize download manager:", e);
  }
  return downloadsState;
}

export function subscribeToDownloads(listener) {
  listeners.add(listener);
  // Initial call with current state
  listener([...downloadsState]);
  return () => {
    listeners.delete(listener);
  };
}

export function getDownloadsState() {
  return downloadsState;
}

export async function startDownload(animeId, animeTitle, animeImage, episodeId, episodeNumber) {
  if (activeDownloads.has(episodeId)) return;

  const controller = new AbortController();
  activeDownloads.set(episodeId, controller);

  const newDownload = {
    episodeId,
    animeId,
    animeTitle,
    animeImage,
    episodeNumber,
    status: 'downloading',
    progress: 0,
    size: 0,
    addedAt: new Date().toISOString(),
  };

  // Add/Update in memory state
  downloadsState = [newDownload, ...downloadsState.filter(d => d.episodeId !== episodeId)];
  notifyListeners();
  await saveDownload(newDownload);

  try {
    const backendUrl = import.meta.env.VITE_API_URL || 'https://anisearch-8jph.onrender.com/api';
    const downloadUrl = `${backendUrl}/episode/${episodeId}/download`;

    const response = await axios.get(downloadUrl, {
      responseType: 'blob',
      signal: controller.signal,
      timeout: 0, // Disable timeout for downloads
      onDownloadProgress: (progressEvent) => {
        const loaded = progressEvent.loaded;
        const total = progressEvent.total || 0;
        const percentCompleted = total > 0 ? Math.round((loaded * 100) / total) : 0;
        
        downloadsState = downloadsState.map(d => {
          if (d.episodeId === episodeId) {
            return { 
              ...d, 
              progress: percentCompleted, 
              size: total || loaded 
            };
          }
          return d;
        });
        notifyListeners();
      }
    });

    const blob = response.data;
    
    // Check if empty response or error response masked as blob
    if (blob.size < 2000 && blob.type.includes('json')) {
      throw new Error("Download failed: empty stream or server error");
    }

    const completedDownload = {
      ...newDownload,
      status: 'completed',
      progress: 100,
      size: blob.size,
      blob: blob // Store actual blob
    };

    downloadsState = downloadsState.map(d => 
      d.episodeId === episodeId ? completedDownload : d
    );
    activeDownloads.delete(episodeId);
    notifyListeners();

    await saveDownload(completedDownload);
  } catch (err) {
    if (axios.isCancel(err) || err.name === 'AbortError' || controller.signal.aborted) {
      console.log(`Download for episode ${episodeId} was cancelled.`);
      return;
    }
    console.error(`Download error for episode ${episodeId}:`, err);
    
    const failedDownload = {
      ...newDownload,
      status: 'failed',
      progress: 0,
      errorMsg: err.message || "Errore di rete o file non disponibile"
    };

    downloadsState = downloadsState.map(d => 
      d.episodeId === episodeId ? failedDownload : d
    );
    activeDownloads.delete(episodeId);
    notifyListeners();

    await saveDownload(failedDownload);
  }
}

export async function cancelDownload(episodeId) {
  const controller = activeDownloads.get(episodeId);
  if (controller) {
    controller.abort();
    activeDownloads.delete(episodeId);
  }
  downloadsState = downloadsState.filter(d => d.episodeId !== episodeId);
  notifyListeners();
  await deleteDownload(episodeId);
}

export async function removeDownloadedEpisode(episodeId) {
  await cancelDownload(episodeId);
}

export async function getDownloadedVideoUrl(episodeId) {
  const download = await getDownload(episodeId);
  if (download && download.status === 'completed' && download.blob) {
    return URL.createObjectURL(download.blob);
  }
  return null;
}
