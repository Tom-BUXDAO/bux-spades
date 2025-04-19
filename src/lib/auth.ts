import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";
import { type User as PrismaUser } from "@prisma/client";

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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
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
      id: "credentials",
      name: "credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          console.error("[Credentials Provider] Missing credentials");
          throw new Error("Please enter both username and password");
        }

        try {
          const user = await prisma.user.findFirst({
            where: {
              OR: [
                { email: credentials.username.toLowerCase() },
                { username: credentials.username.toLowerCase() },
              ],
            },
          });

          if (!user || !user.hashedPassword) {
            console.error("[Credentials Provider] User not found or no password set");
            throw new Error("Invalid username or password");
          }

          const isPasswordValid = await compare(credentials.password, user.hashedPassword);

          if (!isPasswordValid) {
            console.error("[Credentials Provider] Invalid password");
            throw new Error("Invalid username or password");
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            coins: user.coins,
            image: user.image,
          };
        } catch (error) {
          console.error("[Credentials Provider] Auth error:", error);
          throw error;
        }
      },
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
    async jwt({ token, user, account }) {
      if (user) {
        const sessionUser = user as (PrismaUser & { 
          id: string;
          username?: string;
          email?: string;
          coins?: number;
          image?: string;
        });

        let finalUsername = sessionUser.username;
        let finalCoins = sessionUser.coins ?? 0;

        if (account?.provider === "discord" && !sessionUser.username) {
          const generatedUsername = sessionUser.email?.split("@")[0] || `user_${Date.now()}`;
          finalUsername = generatedUsername;
          try {
            await prisma.user.update({
              where: { id: sessionUser.id },
              data: { username: generatedUsername },
            });
          } catch (error) {
            console.error("[Auth JWT Callback] Failed to update username for Discord user:", error);
          }
        }

        token.id = sessionUser.id;
        token.username = finalUsername;
        token.coins = finalCoins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Safely handle the redirect URL
      if (!url) {
        return baseUrl;
      }
      
      try {
        // If the URL is relative, prepend the base URL
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }
        
        // If the URL is absolute and from the same origin, use it
        if (url.startsWith(baseUrl)) {
          return url;
        }
        
        // Default to base URL for any other case
        return baseUrl;
      } catch (error) {
        console.error("[Auth Redirect Callback] Error handling redirect:", error);
        return baseUrl;
      }
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions); 