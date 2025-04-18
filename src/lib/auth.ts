import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";
import { type User, Prisma } from "@prisma/client";

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
  interface AdapterUser extends User {
    id: string;
    username: string;
    coins: number;
    hashedPassword: string | null;
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
              { username: credentials.username } as Prisma.UserWhereInput
            ]
          }
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
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // For Discord login, create a username from the email
        if (account?.provider === "discord" && !user.username) {
          const username = user.email?.split("@")[0] || `user_${Date.now()}`;
          await prisma.user.update({
            where: { id: user.id },
            data: { username }
          });
          return {
            ...token,
            id: user.id,
            username,
            coins: user.coins || 5000000,
            emailVerified: user.emailVerified,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
          };
        }
        return {
          ...token,
          id: user.id,
          username: (user as any).username,
          coins: (user as any).coins,
          emailVerified: user.emailVerified,
          createdAt: (user as any).createdAt,
          updatedAt: (user as any).updatedAt,
        };
      }
      return token;
    },
    async session({ session, token }) {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.id as string,
          username: token.username as string,
          coins: token.coins as number,
          emailVerified: token.emailVerified as Date | null,
          createdAt: token.createdAt as Date,
          updatedAt: token.updatedAt as Date,
        },
      };
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions); 