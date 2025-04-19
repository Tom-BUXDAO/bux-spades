import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare, hash } from "bcryptjs";
import { type User as PrismaUser } from "@prisma/client";
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
  if (typeof window !== 'undefined') return window.location.origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  return 'http://localhost:3000';
};

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login"
  },
  debug: process.env.NODE_ENV === "development",
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: {
        params: {
          scope: "identify email guilds",
          prompt: "consent",
        },
      },
      profile(profile: any): NextAuthUser {
        console.log("[Discord Provider] Profile data:", JSON.stringify(profile));

        let imageUrl: string | undefined;
        if (profile.avatar === null) {
          const defaultAvatarNumber = parseInt(profile.discriminator) % 5;
          imageUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        } else {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
        }

        return {
          id: profile.id,
          name: profile.global_name ?? profile.username,
          email: profile.email,
          image: imageUrl,
          username: profile.username,
          coins: 5000000,
        };
      },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text", optional: true },
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password");
        }

        try {
          // Check if this is a registration attempt
          if (credentials.username) {
            // Check if user already exists
            const existingUser = await prisma.user.findFirst({
              where: {
                OR: [
                  { email: credentials.email },
                  { username: credentials.username }
                ]
              }
            });

            if (existingUser) {
              if (existingUser.email === credentials.email) {
                throw new Error("User with this email already exists");
              } else {
                throw new Error("Username is already taken");
              }
            }

            // Create new user
            const hashedPassword = await hash(credentials.password, 12);
            const newUser = await prisma.user.create({
              data: {
                email: credentials.email,
                username: credentials.username,
                hashedPassword,
                coins: 1000 // Starting coins
              }
            });

            return {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              username: newUser.username,
              coins: newUser.coins,
              image: newUser.image
            } as User;
          } else {
            // Regular login
            const user = await prisma.user.findUnique({
              where: { email: credentials.email }
            });

            if (!user || !user.hashedPassword) {
              throw new Error("Invalid email or password");
            }

            const isPasswordValid = await compare(credentials.password, user.hashedPassword);

            if (!isPasswordValid) {
              throw new Error("Invalid email or password");
            }

            return {
              id: user.id,
              email: user.email,
              name: user.name,
              username: user.username,
              coins: user.coins,
              image: user.image
            } as User;
          }
        } catch (error) {
          console.error("[Auth] Authorization error:", error);
          throw error;
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      console.log("[Auth SignIn Callback] Triggered");
      console.log("[Auth SignIn Callback] Account Provider:", account?.provider);
      
      if (account?.provider === "discord") {
        try {
          const existingUser = await prisma.user.findUnique({
            where: { id: user.id },
          });

          if (!existingUser) {
            console.log("[Auth SignIn Callback] New Discord user detected");
            return true;
          }
        } catch (error) {
          console.error("[Auth SignIn Callback] Error checking user:", error);
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = (user as User).username;
        token.coins = (user as User).coins;
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
    async redirect({ url, baseUrl }) {
      console.log("[Auth] Redirect URL:", url);
      console.log("[Auth] Base URL:", baseUrl);

      // If no URL is provided, redirect to home
      if (!url) {
        return "/game";
      }

      // Ensure we have a valid baseUrl
      const validBaseUrl = baseUrl || getBaseUrl();

      try {
        // Handle relative URLs
        if (url.startsWith("/")) {
          return url;
        }

        // Handle absolute URLs from same origin
        const urlObj = new URL(url);
        if (urlObj.origin === validBaseUrl) {
          return urlObj.pathname;
        }

        // Default to game page for any other case
        return "/game";
      } catch (error) {
        console.error("[Auth] Redirect error:", error);
        return "/game";
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export const getAuthSession = () => getServerSession(authOptions); 