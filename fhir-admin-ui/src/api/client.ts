import axios from 'axios'

const apiClient = axios.create({
  baseURL: '',
  headers: {
    'Content-Type': 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

/** Key under which a one-shot message is handed to the login screen. */
export const AUTH_MESSAGE_KEY = 'auth_message'

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status
    const requestUrl: string = error.config?.url ?? ''

    // A 401 from the login form means bad credentials, not a lapsed session.
    // Let the Login page render that itself rather than clearing state and
    // reloading out from under the user.
    const isLoginAttempt = requestUrl.includes('/api/auth/login')

    // 403 is deliberately not handled here: it means the account is
    // authenticated but lacks the role, so signing out would not help.
    if (status === 401 && !isLoginAttempt) {
      const message =
        error.response?.data?.error ??
        'Your session has ended. Please sign in again.'
      sessionStorage.setItem(AUTH_MESSAGE_KEY, message)

      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient
