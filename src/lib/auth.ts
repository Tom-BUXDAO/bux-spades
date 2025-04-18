import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";
import { type User as PrismaUser, Prisma } from "@prisma/client";

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
  providers: [
    DiscordProvider({
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify email" } },
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username or Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            OR: [
              { email: credentials.username },
              { username: credentials.username },
            ],
          },
        });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const isPasswordValid = await compare(credentials.password, user.hashedPassword);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          coins: user.coins,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      const sessionUser = user as (PrismaUser & { id: string, username?: string, email?: string, coins?: number, image?: string }) | undefined;

      if (sessionUser) {
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
            console.error("Failed to update username for Discord user:", error);
          }
        }

        token.id = sessionUser.id;
        token.username = finalUsername;
        token.coins = finalCoins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions); 