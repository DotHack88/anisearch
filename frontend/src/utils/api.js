import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

export const searchAnime = async (q, limit = 20) => (await api.get('/search', { params: { q, limit } })).data.results
export const getAnimeDetail = async (id) => (await api.get(`/anime/${id}`)).data
export const getStatus = async () => (await api.get('/status')).data
export const getCatalog = async (params) => (await api.get('/catalog', { params })).data
export const getFilters = async () => (await api.get('/filters')).data
export const getEpisodeVideo = async (episodeId) => (await api.get(`/episode/${episodeId}/video`)).data
export const saveWatchProgress = async (animeId, episodeId) => (await api.post(`/watch/${animeId}`, null, { params: { episode_id: episodeId } })).data;
export const deleteWatchProgress = async (animeId, episodeId) => (await api.delete(`/watch/${animeId}`, { params: { episode_id: episodeId } })).data
export const getWatchProgress = async (animeId) => (await api.get(`/watch/${animeId}`)).data
export const getRecentWatchProgress = async () => (await api.get('/watch')).data

export default api
