import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { User } from "@prisma/client";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      coins: number;
      isGuest?: boolean;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    username: string;
    coins: number;
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isGuest?: boolean;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser extends User {
    coins: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    id: string;
    username: string;
    coins: number;
    isGuest?: boolean;
  }
} 