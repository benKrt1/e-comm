/** Human-readable message from a thrown value — the display boundary for errors. */
export const getErrorMessage = (err: unknown) =>
  err instanceof Error && err.message ? err.message : 'Something went wrong — please try again';
