import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 15000,
})

export const searchAnime    = async (q, limit = 20)  => (await api.get('/search', { params: { q, limit } })).data.results
export const getAnimeDetail = async (id)             => (await api.get(`/anime/${id}`)).data
export const getStatus      = async ()               => (await api.get('/status')).data
export const getCatalog     = async (params)         => (await api.get('/catalog', { params })).data
export const getFilters     = async ()               => (await api.get('/filters')).data
export const getEpisodeVideo = async (episodeId)     => (await api.get(`/episode/${episodeId}/video`)).data

export default api
