import { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  interface Session extends DefaultSession {
    user: {
      id: string;
      username: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      coins: number;
      isGuest?: boolean;
      emailVerified?: Date | null;
      createdAt?: Date;
      updatedAt?: Date;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    id: string;
    username: string;
    coins: number;
    isGuest?: boolean;
    emailVerified?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
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
    emailVerified?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }
} 