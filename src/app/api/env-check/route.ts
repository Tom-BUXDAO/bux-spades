import { NextResponse } from "next/server";

export async function GET() {
  // Check if environment variables are set
  const envVars = {
    hasNextAuthUrl: !!process.env.NEXTAUTH_URL,
    hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
    hasDiscordClientId: !!process.env.DISCORD_CLIENT_ID,
    hasDiscordClientSecret: !!process.env.DISCORD_CLIENT_SECRET,
    nextAuthUrl: process.env.NEXTAUTH_URL || "Not set",
    // Don't expose the actual values of secrets
    discordClientId: process.env.DISCORD_CLIENT_ID ? "Set (not shown)" : "Not set",
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET ? "Set (not shown)" : "Not set",
  };

  return NextResponse.json(envVars);
} 