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
      authorization: {
        params: {
          scope: "identify email guilds",
          prompt: "consent",
        },
      },
      profile(profile: any, tokens: any): NextAuthUser | Promise<NextAuthUser> {
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
        } as NextAuthUser;
      },
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
    async signIn({ user, account, profile }) {
      console.log("[Auth SignIn Callback] Triggered");
      console.log("[Auth SignIn Callback] Account Provider:", account?.provider);
      
      if (account?.provider === 'discord') {
        console.log("[Auth SignIn Callback] Discord User (from callback arg):", JSON.stringify(user));
        console.log("[Auth SignIn Callback] Discord Profile:", JSON.stringify(profile));
        
        // Check if this is a new user by looking up their account
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        // If this is a new user, add 'new=true' to the callback URL
        if (!existingUser && account.callbackUrl && typeof account.callbackUrl === 'string') {
          try {
            const callbackUrl = new URL(account.callbackUrl);
            callbackUrl.searchParams.set('new', 'true');
            account.callbackUrl = callbackUrl.toString();
          } catch (error) {
            console.error('Error modifying callback URL:', error);
          }
        }
      } else if (account?.provider === 'credentials') {
        console.log("[Auth SignIn Callback] Credentials User (from callback arg):", JSON.stringify(user));
      }
      return true;
    },
    async jwt({ token, user, account }) {
      console.log("[Auth JWT Callback] Triggered");
      console.log("[Auth JWT Callback] Account Provider:", account?.provider);
      console.log("[Auth JWT Callback] User object:", JSON.stringify(user));

      const sessionUser = user as (PrismaUser & { id: string, username?: string, email?: string, coins?: number, image?: string }) | undefined;
      console.log("[Auth JWT Callback] Parsed sessionUser:", JSON.stringify(sessionUser));

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

        console.log("[Auth JWT Callback] Populating token:", JSON.stringify({ id: sessionUser.id, username: finalUsername, coins: finalCoins }));
        token.id = sessionUser.id;
        token.username = finalUsername;
        token.coins = finalCoins;
      }
      console.log("[Auth JWT Callback] Returning token:", JSON.stringify(token));
      return token;
    },
    async session({ session, token }) {
      console.log("[Auth Session Callback] Triggered");
      console.log("[Auth Session Callback] Received Token:", JSON.stringify(token));
      console.log("[Auth Session Callback] Initial Session:", JSON.stringify(session));
      if (token.id && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      console.log("[Auth Session Callback] Returning Session:", JSON.stringify(session));
      return session;
    },
  },
};

export const getAuthSession = () => getServerSession(authOptions); 