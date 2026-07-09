import { auth } from '@/auth';
import dbConnect from '@/lib/db';
import User from '@/models/User';

export class SessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionError';
  }
}

/**
 * Load the current user fresh from the DB (not from the session token) so
 * role changes and deleted accounts take effect immediately — the same
 * semantics as the old server's protect middleware. Server actions and
 * server-only data functions call this; the proxy only does the optimistic
 * redirect.
 */
export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new SessionError('Not logged in');

  await dbConnect();
  const user = await User.findById(session.user.id);
  if (!user) throw new SessionError('Account no longer exists');

  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== 'admin') throw new SessionError('You do not have permission to do that');
  return user;
}
