import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { env } from "@/env.mjs";
import { compare, hash } from "bcryptjs";
import { User } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      username: string;
      coins: number;
    };
  }
}

// Ensure we have a valid base URL
const getBaseUrl = () => {
  // For server-side
  if (typeof window === 'undefined') {
    // Vercel
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    
    // Render
    if (process.env.RENDER_INTERNAL_HOSTNAME) {
      return `https://${process.env.RENDER_INTERNAL_HOSTNAME}`;
    }
    
    // Railway
    if (process.env.RAILWAY_STATIC_URL) {
      return process.env.RAILWAY_STATIC_URL;
    }
    
    // Netlify
    if (process.env.URL) {
      return process.env.URL;
    }
    
    // Explicit NEXTAUTH_URL
    if (process.env.NEXTAUTH_URL) {
      return process.env.NEXTAUTH_URL;
    }
    
    // Default to localhost
    return 'http://localhost:3000';
  }
  
  // For client-side
  return '';
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            throw new Error("Invalid credentials");
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email,
            },
          });

          if (!user || !user.hashedPassword) {
            throw new Error("User not found");
          }

          const isPasswordValid = await compare(credentials.password, user.hashedPassword);

          if (!isPasswordValid) {
            throw new Error("Invalid password");
          }

          return {
            id: user.id,
            email: user.email,
            name: user.username,
            username: user.username,
            coins: user.coins,
            image: user.image,
          };
        } catch (error) {
          console.error("Auth error:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          name: user.name,
          username: (user as any).username,
          coins: (user as any).coins,
        };
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id,
          name: token.name,
          username: token.username as string,
          coins: token.coins as number,
        },
      };
    },
  },
  debug: process.env.NODE_ENV === "development",
};

export const getAuthSession = () => getServerSession(authOptions); 