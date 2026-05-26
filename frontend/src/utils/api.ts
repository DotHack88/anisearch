import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
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

export default api
