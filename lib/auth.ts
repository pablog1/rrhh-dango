import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'admin@example.com' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        // Validate credentials exist
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        // Get admin credentials from environment
        const adminEmail = process.env.ADMIN_EMAIL;
        const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;

        // Validate environment variables are set
        if (!adminEmail || !adminPasswordHash) {
          console.error('[Auth] ADMIN_EMAIL or ADMIN_PASSWORD_HASH not configured');
          return null;
        }

        // Check if email matches
        if (credentials.email !== adminEmail) {
          return null;
        }

        // Verify password using bcrypt
        const isValidPassword = await bcrypt.compare(
          credentials.password,
          adminPasswordHash
        );

        if (!isValidPassword) {
          return null;
        }

        // Return user object if authentication successful
        return {
          id: '1',
          email: credentials.email,
          name: 'Admin',
        };
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
