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
  // In the browser, return the current origin
  if (typeof window !== "undefined") {
    console.log("Browser environment, using window.location.origin:", window.location.origin);
    return window.location.origin;
  }

  // Get the base URL from environment variables
  const vercelUrl = process.env.VERCEL_URL;
  const nextAuthUrl = process.env.NEXTAUTH_URL;

  console.log("VERCEL_URL:", vercelUrl);
  console.log("NEXTAUTH_URL:", nextAuthUrl);

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

          if (!user || !user.hashedPassword) {
            console.log("No user found or no password set");
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

          const userData = {
            id: user.id,
            email: user.email,
            username: user.username || "",
            coins: user.coins,
            image: user.image
          };

          console.log("Returning user data:", userData);
          return userData;
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
      console.log("JWT callback - token:", token);
      console.log("JWT callback - user:", user);
      
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }) {
      console.log("Session callback - session:", session);
      console.log("Session callback - token:", token);
      
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string | null;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log("Redirect callback - url:", url);
      console.log("Redirect callback - baseUrl:", baseUrl);

      // If url is undefined or null, return baseUrl
      if (!url) {
        console.log("URL is undefined or null, returning baseUrl:", baseUrl);
        return baseUrl;
      }

      try {
        // Handle relative URLs
        if (url.startsWith("/")) {
          const fullUrl = `${baseUrl}${url}`;
          console.log("Constructed full URL for relative path:", fullUrl);
          return fullUrl;
        }

        // Handle absolute URLs
        const urlObj = new URL(url);
        console.log("Parsed URL object:", urlObj.toString());

        // Allow URLs from the same origin
        if (urlObj.origin === new URL(baseUrl).origin) {
          console.log("URL is from same origin, allowing:", url);
          return url;
        }

        // Allow Vercel URLs
        if (url.includes("vercel.app")) {
          console.log("URL is from Vercel, allowing:", url);
          return url;
        }

        // Default to base URL
        console.log("Defaulting to baseUrl:", baseUrl);
        return baseUrl;
      } catch (error) {
        console.error("Error in redirect callback:", error);
        return baseUrl;
      }
    },
  },
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions); 