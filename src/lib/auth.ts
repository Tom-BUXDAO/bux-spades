import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type User as NextAuthUser } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "./prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: "jwt",
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
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Please enter both email and password");
        }

        try {
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

      if (!url) {
        return baseUrl;
      }

      if (typeof url !== "string") {
        return baseUrl;
      }

      try {
        // Handle relative URLs
        if (url.startsWith("/")) {
          return `${baseUrl}${url}`;
        }

        // Handle absolute URLs from same origin
        const urlObj = new URL(url);
        if (urlObj.origin === baseUrl) {
          return url;
        }

        // Default to base URL for any other case
        return baseUrl;
      } catch (error) {
        console.error("[Auth] Redirect error:", error);
        return baseUrl;
      }
    }
  },
  secret: process.env.NEXTAUTH_SECRET
};

export const getAuthSession = () => getServerSession(authOptions); 