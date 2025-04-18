"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        username: username,
        password: password,
        callbackUrl: "/game"
      });

      if (result?.error) {
        console.error("Login failed:", result.error);
        setError("Invalid username or password.");
        setIsLoading(false);
      } else if (result?.url) {
        // Successful login, NextAuth handles the redirect based on callbackUrl
        // No need to manually redirect here if callbackUrl is set
        // window.location.href = result.url; // Let NextAuth handle redirect
      } else {
        setError("An unexpected error occurred during login.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-white text-center">Join Spades Game</h1>

        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div>
            <label htmlFor="username" className="sr-only">Username</label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Username"
            />
          </div>
          <div>
            <label htmlFor="password"className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
              placeholder="Password"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
          <p className="text-sm text-gray-400 text-center">
            Don't have an account?{' '}
            <Link href="/register" className="font-medium text-blue-400 hover:text-blue-300">
              Register here
            </Link>
          </p>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-600"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-gray-800 text-gray-400">or</span>
          </div>
        </div>

        <button
          onClick={() => signIn("discord", { callbackUrl: "/game" })}
          className="w-full flex items-center justify-center gap-3 bg-[#5865F2] text-white py-3 px-4 rounded-lg hover:bg-[#4752C4] transition-colors"
          disabled={isLoading}
        >
          <Image
            src="/discord-mark-white.svg"
            alt="Discord"
            width={24}
            height={24}
          />
          Sign in with Discord
        </button>
      </div>
    </div>
  );
} 