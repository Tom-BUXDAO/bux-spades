import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: | null;
      email: string | null;
      username: string;
      coins: number;
      image?: string | null;
    };
  }
}

// Simple function to get the base URL
function getBaseUrl() {
  if (typeof window !== 'undefined') {
    // Browser should use relative path
    return '';
  }

  if (process.env.VERCEL_URL) {
    // Reference for vercel.com
    return `https://${process.env.VERCEL_URL}`;
  }

  if (process.env.NEXTAUTH_URL) {
    // Reference for render.com
    return process.env.NEXTAUTH_URL;
  }

  // Assume localhost
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "database",
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
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email
          }
        });

        if (!user || !user.hashedPassword) {
          throw new Error("Invalid email or password");
        }

        const isCorrectPassword = await compare(
          credentials.password,
          user.hashedPassword
        );

        if (!isCorrectPassword) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username || "",
          coins: user.coins,
          image: user.image
        };
      }
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string | null;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // If the url is relative, prefix it with the base URL
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      
      // If the url is already absolute, return it
      if (url.startsWith("http")) {
        return url;
      }
      
      // Default to the game page
      return `${baseUrl}/game`;
    },
  },
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions); 