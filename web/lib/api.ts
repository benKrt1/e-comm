import axios from 'axios';

/**
 * One shared axios instance. Cookies always travel (withCredentials) so the
 * httpOnly JWT rides along, and every call is relative to the versioned API
 * root. In dev the Next rewrite forwards /api → the Express server (same
 * origin, no CORS); in production NEXT_PUBLIC_API_URL points at the API host.
 */
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? '/api/v1',
  withCredentials: true,
});

/** Extract the server's error-envelope message, with a safe fallback. */
export const getErrorMessage = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.message ?? 'Something went wrong — please try again';
  }
  if (err instanceof Error && err.message) return err.message;
  return 'Something went wrong — please try again';
};

export default api;
