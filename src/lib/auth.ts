import { PrismaAdapter } from "@next-auth/prisma-adapter";
import { getServerSession } from "next-auth";
import { type NextAuthOptions, type DefaultSession } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import DiscordProvider from "next-auth/providers/discord";
import { prisma } from "@/lib/prisma";
import { env } from "@/env.mjs";
import { compare } from "bcryptjs";

// Extend the built-in session type
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      username: string;
      coins: number;
      image?: string | null;
    } & DefaultSession["user"]
  }

  interface User {
    id: string;
    name: string;
    email: string;
    username: string;
    coins: number;
    image?: string | null;
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) {
            console.error("Missing credentials");
            return null;
          }

          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email
            }
          });

          if (!user || !user.email) {
            console.error("User not found");
            return null;
          }

          if (!user.hashedPassword) {
            console.error("User has no password");
            return null;
          }

          const isCorrectPassword = await compare(
            credentials.password,
            user.hashedPassword
          );

          if (!isCorrectPassword) {
            console.error("Incorrect password");
            return null;
          }

          console.log("Authentication successful for user:", user.email);
          return {
            id: user.id,
            name: user.username || user.name || user.email.split('@')[0],
            email: user.email,
            username: user.username || user.email.split('@')[0],
            coins: user.coins,
            image: user.image
          };
        } catch (error) {
          console.error("Authentication error:", error);
          return null;
        }
      }
    }),
    DiscordProvider({
      clientId: process.env.DISCORD_CLIENT_ID!,
      clientSecret: process.env.DISCORD_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'identify email',
        },
      },
      async profile(profile: any) {
        // Ensure we have a username
        if (!profile.username) {
          throw new Error("Discord profile missing username");
        }

        let imageUrl: string | null = null;
        if (profile.avatar) {
          const format = profile.avatar.startsWith("a_") ? "gif" : "png";
          imageUrl = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.${format}`;
        } else {
          const defaultAvatarNumber = parseInt(profile.discriminator) % 5;
          imageUrl = `https://cdn.discordapp.com/embed/avatars/${defaultAvatarNumber}.png`;
        }

        // Create or update user in database
        const user = await prisma.user.upsert({
          where: { email: profile.email },
          update: {
            name: profile.username,
            image: imageUrl,
            username: profile.username,
          },
          create: {
            email: profile.email,
            name: profile.username,
            image: imageUrl,
            username: profile.username,
            coins: 1000,
          },
        });

        // Ensure all required fields are non-null
        return {
          id: user.id,
          name: user.username || profile.username,
          email: user.email || profile.email,
          username: user.username || profile.username,
          image: user.image,
          coins: user.coins || 1000,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.username = user.username;
        token.coins = user.coins;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.username = token.username as string;
        session.user.coins = token.coins as number;
      }
      return session;
    },
    async redirect({ url, baseUrl }) {
      // Always redirect to /game after login
      return `${baseUrl}/game`;
    }
  },
  debug: true,
  secret: process.env.NEXTAUTH_SECRET,
};

export const getAuthSession = () => getServerSession(authOptions); 