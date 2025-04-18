import { PrismaAdapter } from "@auth/prisma-adapter";
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

declare module "next-auth/adapters" {
  interface AdapterUser extends PrismaAdapterUser {
    username: string;
    coins: number;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
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

        const whereInput: Prisma.UserWhereInput = {
          OR: [
            { email: credentials.username },
            { username: credentials.username }
          ]
        };

        const user: PrismaUser | null = await prisma.user.findFirst({ where: whereInput });

        if (!user || !user.hashedPassword) {
          return null;
        }

        const isPasswordValid = await compare(credentials.password, user.hashedPassword);

        if (!isPasswordValid) {
          return null;
        }

        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, isNewUser }) {
      const dbUser = user as PrismaUser | undefined;

      if (dbUser) {
        let userCoins = dbUser.coins ?? 0;
        let finalUsername = dbUser.username;
        let dbUpdateData: Prisma.UserUpdateInput = {};

        if (account?.provider === "discord") {
          if (!dbUser.username) {
            const generatedUsername = dbUser.email?.split("@")[0] || `user_${Date.now()}`;
            dbUpdateData.username = generatedUsername;
            finalUsername = generatedUsername;
          }

          if (isNewUser) {
            if (dbUser.coins === null || dbUser.coins === undefined || dbUser.coins === 0) {
                userCoins = 5000000;
                dbUpdateData.coins = userCoins;
            }
          }
        }

        if (Object.keys(dbUpdateData).length > 0) {
          try {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: dbUpdateData
            });
          } catch (error) {
            console.error("Failed to update user during JWT callback:", error);
          }
        }

        token.id = dbUser.id;
        token.username = finalUsername;
        token.coins = userCoins;
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