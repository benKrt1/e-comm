import type { UserDoc } from '../models/User.ts';

// The `protect` middleware loads the current user fresh from the DB and
// attaches it here; downstream handlers read req.user.
declare global {
  namespace Express {
    interface Request {
      user?: UserDoc;
    }
  }
}

export {};
