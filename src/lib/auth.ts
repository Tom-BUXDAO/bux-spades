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
      name: string | null;
      email: string | null;
      username: string;
      coins: number;
      image?: string | null;
    };
  }
}

function getBaseUrl() {
  // Temporarily hardcode a base URL for testing
  return "https://bux-spades-buxdaos-projects.vercel.app";

  // In the browser, return the current origin
  if (typeof window !== "undefined") {
    console.log("Browser environment, using window.location.origin:", window.location.origin);
    return window.location.origin;
  }

  // Get the base URL from environment variables
  const vercelUrl = process.env.VERCEL_URL;
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  // If we have a NextAuth URL, use it
  if (nextAuthUrl) {
    console.log("Using NEXTAUTH_URL:", nextAuthUrl);
    return nextAuthUrl;
  }

  // If we have a Vercel URL, use it
  if (vercelUrl) {
    console.log("Using VERCEL_URL:", vercelUrl);
    return `https://${vercelUrl}`;
  }

  // Default to localhost in development
  console.log("Defaulting to localhost");
  return "http://localhost:3000";
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 days
    secret: process.env.NEXTAUTH_SECRET,
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
        try {
          console.log("Authorize function called with credentials:", credentials);
          if (!credentials?.email || !credentials?.password) {
            console.log("Missing email or password");
            return null;
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          });

          console.log("User found:", user);

          if (!user) {
            console.log("No user found with the provided email");
            return null;
          }

          // If user has no password (Discord user), don't allow credentials login
          if (!user.hashedPassword) {
            console.log("User has no password, likely a Discord user");
            return null;
          }

          const isCorrectPassword = await compare(
            credentials.password,
            user.hashedPassword
          );

          console.log("Password match:", isCorrectPassword);

          if (!isCorrectPassword) {
            console.log("Incorrect password");
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            username: user.username || "",
            coins: user.coins,
            image: user.image
          };
        } catch (error) {
          console.error("Auth error:", error);
          return null;
        }
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
      try {
        // Allow relative URLs
        if (url.startsWith("/")) return `${baseUrl}${url}`;
        
        // Allow URLs from the same origin
        if (new URL(url).origin === baseUrl) return url;
        
        // Allow Vercel preview URLs
        if (url.includes(process.env.VERCEL_URL || "")) return url;
        
        // Allow URLs from the same project
        if (url.includes("bux-spades")) return url;
        
        // Default to base URL
        return baseUrl;
      } catch (error) {
        console.error("Error in redirect callback:", error);
        return baseUrl;
      }
    },
  },
  debug: process.env.NODE_ENV === "development",
  secret: process.env.NEXTAUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions); 