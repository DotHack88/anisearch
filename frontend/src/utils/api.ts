import axios from 'axios'
import { getSessionId } from './session'

// In sviluppo (npm run dev): usa il proxy Vite locale → http://localhost:8000
// In produzione (Vercel): usa VITE_API_URL o il fallback su Render
const API_BASE = import.meta.env.DEV ? '/api' : (import.meta.env.VITE_API_URL || 'https://anisearch-8jph.onrender.com/api')

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: false,
})

// Aggiungi automaticamente X-Session-Id a ogni richiesta
api.interceptors.request.use((config) => {
  config.headers['X-Session-Id'] = getSessionId()
  return config
})

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
export const getRecentWatchProgress = async () => (await api.get('/watch')).data

export const getFavorites = async () => (await api.get<Anime[]>('/favorites')).data
export const addFavorite = async (animeId: string) => (await api.post(`/favorites/${animeId}`)).data
export const removeFavoriteApi = async (animeId: string) => (await api.delete(`/favorites/${animeId}`)).data

export default api
