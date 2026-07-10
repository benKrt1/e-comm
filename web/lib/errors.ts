// Re-exported from the axios layer so it understands the API error envelope
// (err.response.data.message). Kept here for the existing import paths.
export { getErrorMessage } from '@/lib/api';
