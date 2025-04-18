import { PrismaAdapter } from "@auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";
import { type User } from "@prisma/client";

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
  interface AdapterUser {
    id: string;
    name: string | null;
    email: string | null;
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
          return null;
        }

        const user = await prisma.user.findUnique({
          where: {
            email: credentials.email,
          },
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            coins: true,
            hashedPassword: true,
            emailVerified: true,
            createdAt: true,
            updatedAt: true,
            image: true,
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
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        return {
          ...token,
          id: user.id,
          username: user.username,
          coins: user.coins,
          emailVerified: user.emailVerified,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
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