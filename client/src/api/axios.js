import axios from 'axios';

// One shared instance: cookies always travel (withCredentials) and every
// call is relative to the versioned API root. In dev the Vite proxy
// forwards /api to Express; in production VITE_API_URL points at Render.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api/v1',
  withCredentials: true,
});

/** Extract the server's error envelope message, with a safe fallback. */
export const getErrorMessage = (err) =>
  err.response?.data?.message ?? 'Something went wrong — please try again';

export default api;
