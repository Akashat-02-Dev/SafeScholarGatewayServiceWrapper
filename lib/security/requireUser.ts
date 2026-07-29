/**
 * Auth guard for gateway API routes.
 *
 * Returns the authenticated user's id + tier, or `null` if unauthenticated.
 * Uses NextAuth's `getServerSession`.
 */

import type { NextApiRequest } from 'next';

export interface AuthUser {
  id: string;
  tier: 'free' | 'pro' | 'admin';
}

/**
 * In production this calls NextAuth's getServerSession.
 * The import is dynamic so this file doesn't break if next-auth is not yet
 * installed during early development.
 */
export async function requireUser(_req: NextApiRequest): Promise<AuthUser | null> {
  try {
    // Dynamic import to avoid hard dependency during scaffolding
    const { getServerSession } = await import('next-auth');
    const { authOptions } = await import('@/config/auth');

    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const userId = (session.user as { id?: string }).id;
    if (!userId) return null;

    return {
      id: userId,
      tier: (session.user as { tier?: AuthUser['tier'] }).tier ?? 'free',
    };
  } catch {
    // If next-auth isn't configured yet, fall back to a dev-only header.
    if (process.env.NODE_ENV === 'development') {
      const devUserId = _req.headers['x-dev-user-id'] as string | undefined;
      if (devUserId) {
        return { id: devUserId, tier: 'free' };
      }
    }
    return null;
  }
}
