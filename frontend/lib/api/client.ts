import axios, { AxiosError, type AxiosRequestConfig, type AxiosRequestHeaders } from "axios"
import { store } from "@/lib/store/store"
import { setAccessToken, clearAccessToken, logout } from "@/lib/store/slices/authSlice"

const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim()

const apiClient = axios.create({
  baseURL: `${API}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

// ---- Request: attach Authorization ----
apiClient.interceptors.request.use((config) => {
  const token = store.getState().auth.accessToken
  if (token) {
    // Ensure headers object exists and is the right type
    if (!config.headers) {
      config.headers = {} as AxiosRequestHeaders
    }
    ;(config.headers as AxiosRequestHeaders).Authorization = `Bearer ${token}`
  }
  return config
})

// ---- 401 handling with refresh queue (robust) ----
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  try {
    const res = await axios.post(`${API}/api/token/refresh/`, {}, { withCredentials: true })
    const newAccess = res.data?.access ?? null
    if (newAccess) store.dispatch(setAccessToken(newAccess))
    return newAccess
  } catch {
    return null
  }
}

apiClient.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as (AxiosRequestConfig & { _retry?: boolean }) | undefined
    if (!error.response || !original) return Promise.reject(error)
    if (error.response.status !== 401 || original._retry) return Promise.reject(error)

    // If no token was attached, this is an unauthenticated endpoint — don't refresh
    const hadAuth = original.headers?.Authorization
    if (!hadAuth) return Promise.reject(error)

    original._retry = true

    if (!isRefreshing) {
      isRefreshing = true
      refreshPromise = refreshAccess().finally(() => {
        isRefreshing = false
        refreshPromise = null
      })
    }

    const newAccess = await refreshPromise!

    if (!newAccess) {
      store.dispatch(clearAccessToken())
      store.dispatch(logout())
      return Promise.reject(new Error("AUTH_EXPIRED"))
    }

    original.headers = (original.headers ?? {}) as AxiosRequestHeaders
    ;(original.headers as AxiosRequestHeaders).Authorization = `Bearer ${newAccess}`
    return apiClient(original)
  }
)

export default apiClient