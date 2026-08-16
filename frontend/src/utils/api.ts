import axios from 'axios'
import { getSessionId } from './session'

// API base URL:
// - Sviluppo locale: http://localhost:8000 (uvicorn diretto, senza prefisso /api)
// - Produzione (Render + Vercel): https://anisearch-8jph.onrender.com/api
//   Nginx su Render proxia /api/* → uvicorn. Senza il prefisso /api, Nginx serve la SPA React.
const API_BASE = import.meta.env.VITE_API_BASE_URL || (
  import.meta.env.DEV ? 'http://localhost:8000' : 'https://anisearch-8jph.onrender.com/api'
)


const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
})

// Aggiungi automaticamente X-Session-Id e Authorization a ogni richiesta
api.interceptors.request.use((config) => {
  config.headers['X-Session-Id'] = getSessionId()
  
  const token = localStorage.getItem('anisearch_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  
  return config
})

export const uploadAvatar = async (file: File) => {
  const formData = new FormData()
  formData.append('file', file)
  return (await api.post<{url: string}>('/upload-avatar', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  })).data
}

export interface Anime {
  id: string;
  title: string;
  url: string;
  image: string;
  type: string;
  status: string;
  year: string | null;
  rating: string | null;
  genres: string[];
}

export interface Episode {
  id: string;
  anime_id: string;
  title: string;
  number: number;
  season?: number;
  url: string;
}

export interface CatalogResponse {
  items: Anime[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export const searchAnime = async (q: string, limit = 20) => (await api.get<{results: Anime[]}>('/search', { params: { q, limit } })).data.results
export const getAnimeDetail = async (id: string) => (await api.get<Anime & { episodes: Episode[] }>(`/anime/${id}`)).data
export const getStatus = async () => (await api.get('/status')).data
export const getCatalog = async (params: Record<string, unknown>) => (await api.get<CatalogResponse>('/catalog', { params })).data
export const getFilters = async () => (await api.get('/filters')).data
export const getEpisodeVideo = async (episodeId: string) => (await api.get<{ video_url: string }>(`/episode/${episodeId}/video`)).data
export const saveWatchProgress = async (animeId: string, episodeId: string) => (await api.post(`/watch/${animeId}`, null, { params: { episode_id: episodeId } })).data;
export const deleteWatchProgress = async (animeId: string, episodeId: string) => (await api.delete(`/watch/${animeId}`, { params: { episode_id: episodeId } })).data
export const getWatchProgress = async (animeId: string) => (await api.get(`/watch/${animeId}`)).data
export const getRecentWatchProgress = async () => {
  const data = (await api.get('/watch')).data
  return Array.isArray(data) ? data : []
}

export const getFavorites = async () => (await api.get<Anime[]>('/favorites')).data
export const getRecommendations = async (limit = 12) => {
  const data = (await api.get<Anime[]>('/recommendations', { params: { limit } })).data
  return Array.isArray(data) ? data : []
}
export const addFavorite = async (animeId: string) => (await api.post(`/favorites/${animeId}`)).data
export const removeFavoriteApi = async (animeId: string) => (await api.delete(`/favorites/${animeId}`)).data

export interface WatchlistItem extends Anime {
  watchlist_status: string;
  episodes_watched: number;
  episodes_total: number | null;
  progress: number;
  notes: string | null;
  added_at: string | null;
  last_update: string | null;
  completed_at: string | null;
}

export const getWatchlist = async (status?: string) => {
  const data = (await api.get<WatchlistItem[]>('/watchlist', { params: status ? { status } : {} })).data
  return Array.isArray(data) ? data : []
}
export const getWatchlistStats = async () => (await api.get('/watchlist/stats')).data
export const addWatchlist = async (animeId: string, status: string = 'da_guardare', episodesWatched?: number, episodesTotal?: number, notes?: string) =>
  (await api.post(`/watchlist/${animeId}`, null, { params: { status, ...(episodesWatched != null && { episodes_watched: episodesWatched }), ...(episodesTotal != null && { episodes_total: episodesTotal }), ...(notes != null && { notes }) } })).data
export const updateWatchlist = async (animeId: string, status: string, episodesWatched?: number, episodesTotal?: number, notes?: string) =>
  (await api.put(`/watchlist/${animeId}`, null, { params: { status, ...(episodesWatched != null && { episodes_watched: episodesWatched }), ...(episodesTotal != null && { episodes_total: episodesTotal }), ...(notes != null && { notes }) } })).data
export const removeWatchlistApi = async (animeId: string) => (await api.delete(`/watchlist/${animeId}`)).data


// ---------------- MANGA API ----------------

export interface Manga {
  id: string;
  title: string;
  url: string;
  image: string;
  type: string;
  status: string;
  year: string | null;
  rating: string | null;
  genres: string[];
}

export interface Chapter {
  id: string;
  manga_id: string;
  title: string;
  number: number;
  volume?: number;
  url: string;
}

export interface MangaCatalogResponse {
  items: Manga[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface MangaWatchlistItem extends Manga {
  watchlist_status: string;
  chapters_read: number;
  chapters_total: number | null;
  notes: string | null;
  added_at: string | null;
  last_update: string | null;
}

export const searchManga = async (q: string) => (await api.get<{results: Manga[]}>('/manga/search', { params: { q } })).data.results
export const getMangaDetail = async (id: string) => (await api.get<Manga & { chapters: Chapter[], description?: string, author?: string, artist?: string }>(`/manga/${id}`)).data
export const getMangaCatalog = async (params: Record<string, unknown>) => (await api.get<MangaCatalogResponse>('/manga/catalog', { params })).data
export const getChapterImages = async (chapterId: string, mangaId?: string) => (await api.get<{ chapter_id: string, images: string[] }>(`/manga/chapter/${chapterId}/images`, { params: mangaId ? { manga_id: mangaId } : {} })).data

export const saveMangaWatchProgress = async (mangaId: string, chapterId: string) => (await api.post(`/manga-watch/${mangaId}`, null, { params: { chapter_id: chapterId } })).data;
export const getMangaWatchProgress = async (mangaId: string) => (await api.get(`/manga-watch/${mangaId}`)).data
export const getRecentMangaWatchProgress = async () => {
  const data = (await api.get('/manga-watch')).data
  return Array.isArray(data) ? data : []
}
export const deleteMangaWatchProgress = async (mangaId: string) => (await api.delete(`/manga-watch/${mangaId}`)).data

export const getMangaFavorites = async () => (await api.get<Manga[]>('/manga-favorites')).data
export const addMangaFavorite = async (mangaId: string) => (await api.post(`/manga-favorites/${mangaId}`)).data
export const removeMangaFavoriteApi = async (mangaId: string) => (await api.delete(`/manga-favorites/${mangaId}`)).data

export const getMangaWatchlist = async (status?: string) => {
  const data = (await api.get<MangaWatchlistItem[]>('/manga-watchlist', { params: status ? { status } : {} })).data
  return Array.isArray(data) ? data : []
}
export const addMangaWatchlist = async (mangaId: string, status: string = 'da_leggere', chaptersRead?: number, chaptersTotal?: number, notes?: string) =>
  (await api.post(`/manga-watchlist/${mangaId}`, null, { params: { status, ...(chaptersRead != null && { chapters_read: chaptersRead }), ...(chaptersTotal != null && { chapters_total: chaptersTotal }), ...(notes != null && { notes }) } })).data
export const updateMangaWatchlist = async (mangaId: string, status: string, chaptersRead?: number, chaptersTotal?: number, notes?: string) =>
  (await api.put(`/manga-watchlist/${mangaId}`, null, { params: { status, ...(chaptersRead != null && { chapters_read: chaptersRead }), ...(chaptersTotal != null && { chapters_total: chaptersTotal }), ...(notes != null && { notes }) } })).data
export const removeMangaWatchlistApi = async (mangaId: string) => (await api.delete(`/manga-watchlist/${mangaId}`)).data

// ---------------- NOTIFICATIONS API ----------------
export const getVapidPublicKey = async () => (await api.get<{public_key: string}>('/notifications/vapid-public-key')).data.public_key
export const subscribePush = async (subscription: PushSubscription) => (await api.post('/notifications/subscribe', subscription)).data

// ---------------- WATCH PARTY API ----------------
export const createParty = async (animeId: string, episodeId: string, animeTitle: string, episodeTitle: string) =>
  (await api.post<{room_id: string}>('/party/create', null, { params: { anime_id: animeId, episode_id: episodeId, anime_title: animeTitle, episode_title: episodeTitle } })).data
export const getPartyInfo = async (roomId: string) =>
  (await api.get<{room_id: string, anime_id: string, episode_id: string, anime_title: string, episode_title: string, member_count: number}>(`/party/${roomId}/info`)).data

// ---------------- SMART TV CAST API (DLNA/UPnP — solo rete locale) ----------------

export interface CastDevice {
  id: string;
  name: string;
  model: string;
  manufacturer: string;
  type: 'samsung' | 'lg' | 'sony' | 'philips' | 'fire' | 'apple' | 'roku' | 'tv';
  device_url: string;
  av_transport_url: string;
}

export const getCastDevices = async (): Promise<{ devices: CastDevice[]; count: number }> =>
  (await api.get<{ devices: CastDevice[]; count: number }>('/cast/devices')).data

export const castPlay = async (
  deviceUrl: string,
  videoUrl: string,
  title: string,
  imageUrl?: string
) => (await api.post('/cast/play', { device_url: deviceUrl, video_url: videoUrl, title, image_url: imageUrl || '' })).data

export const castPause = async (deviceUrl: string) =>
  (await api.post('/cast/pause', { device_url: deviceUrl })).data

export const castStop = async (deviceUrl: string) =>
  (await api.post('/cast/stop', { device_url: deviceUrl })).data

export const getCastStatus = async (deviceUrl: string) =>
  (await api.get<{ state: string; available: boolean; device_name?: string }>('/cast/status', { params: { device_url: deviceUrl } })).data

export default api
