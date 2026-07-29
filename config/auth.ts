/**
 * NextAuth configuration.
 *
 * SafeScholar uses a credentials provider backed by the existing user table.
 * Extend the session callback to include `tier` for rate-limiting.
 */

import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // TODO: Replace with real DB lookup (Prisma / Drizzle)
        if (!credentials?.email || !credentials?.password) return null;

        // Example:
        // const user = await db.user.findUnique({ where: { email: credentials.email } });
        // const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        // if (!valid) return null;

        return {
          id: 'placeholder-user-id',
          email: credentials.email,
          name: 'Placeholder User',
        };
      },
    }),
  ],
  session: { strategy: 'jwt' },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tier = 'free'; // TODO: load from DB
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { tier?: string }).tier = (token.tier as string) || 'free';
      }
      return session;
    },
  },
};
