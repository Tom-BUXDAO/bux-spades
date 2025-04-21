import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      username: string;
      coins: number;
      image?: string | null;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    name: string;
    email: string;
    username: string;
    coins: number;
    image?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Missing credentials");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.username) {
          throw new Error("No user found");
        }

        // In a real app, you would hash and compare passwords here
        if (credentials.password !== user.hashedPassword) {
          throw new Error("Invalid password");
        }

        return {
          id: user.id,
          email: user.email!,
          name: user.name!,
          username: user.username,
          coins: user.coins,
          image: user.image,
        };
      },
    }),
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify email",
          prompt: "consent",
        },
      },
      profile(profile) {
        return {
          id: profile.id,
          name: profile.username,
          email: profile.email,
          username: profile.username.toLowerCase().replace(/\s+/g, '_'),
          coins: 1000,
          image: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.coins = user.coins;
      }
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
    async signIn({ user, account, profile }) {
      if (account?.provider === "discord") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { email: user.email! },
          });

          if (!existingUser) {
            await prisma.user.create({
              data: {
                email: user.email!,
                name: user.name!,
                username: user.username,
                coins: 1000,
                image: user.image,
                hashedPassword: Math.random().toString(36).slice(-8),
              },
            });
          }
          return true;
        } catch (error) {
          console.error("Error in signIn callback:", error);
          return false;
        }
      }
      return true;
    },
    async redirect({ url, baseUrl }) {
      // If the URL is relative, prefix it with the base URL
      if (url.startsWith('/')) {
        return `${baseUrl}${url}`;
      }
      
      // If the URL is absolute and on the same origin, allow it
      if (url.startsWith(baseUrl)) {
        return url;
      }
      
      // Default to the base URL
      return baseUrl;
    },
  },
  debug: true,
  secret: env.NEXTAUTH_SECRET,
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production'
      }
    }
  }
};

export const getAuthSession = () => getServerSession(authOptions); 