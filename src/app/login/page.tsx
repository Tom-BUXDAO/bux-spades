"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import WelcomeModal from "@/components/WelcomeModal";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { data: session, status } = useSession();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check for error in URL parameters
    const errorParam = searchParams?.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }
  }, [searchParams]);

  // If user is already logged in, redirect to game page
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/game");
    }
  }, [status, router]);

  if (status === "loading" || status === "authenticated") {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      // For login, use email and password
      if (!isRegistering) {
        const result = await signIn("credentials", {
          redirect: false,
          email,
          password,
        });

        if (result?.error) {
          console.error("[Login] Authentication error:", result.error);
          setError(result.error);
          setIsLoading(false);
          return;
        }

        if (result?.ok) {
          console.log("[Login] Authentication successful");
          router.push("/game");
        }
      } else {
        // For registration, use username, email, and password
        const result = await signIn("credentials", {
          redirect: false,
          username,
          email,
          password,
        });

        if (result?.error) {
          console.error("[Registration] Authentication error:", result.error);
          setError(result.error);
          setIsLoading(false);
          return;
        }

        if (result?.ok) {
          console.log("[Registration] Authentication successful");
          router.push("/game");
        }
      }
    } catch (error) {
      console.error("[Login] Unexpected error:", error);
      setError("An unexpected error occurred. Please try again.");
      setIsLoading(false);
    }
  };

  const handleDiscordSignIn = () => {
    signIn("discord", { 
      callbackUrl: "/game",
      redirect: true
    });
  };

  const handleWelcomeModalClose = () => {
    setShowWelcomeModal(false);
    router.push("/game");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
        <div className="flex items-center justify-center space-x-4">
          <img
            src="/icon.png"
            alt="BUX Logo"
            width="128"
            height="128"
            className="rounded-lg"
          />
          <h1 className="text-3xl font-bold text-white">BUX Spades</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
          
          {isRegistering && (
            <div>
              <label htmlFor="email" className="sr-only">Email</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                placeholder="Email"
              />
            </div>
          )}

          <div className="relative">
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete={isRegistering ? "new-password" : "current-password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none pr-12"
              placeholder="Password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 focus:outline-none"
            >
              {showPassword ? (
                <FaEyeSlash className="w-5 h-5" />
              ) : (
                <FaEye className="w-5 h-5" />
              )}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : (isRegistering ? "Create Account" : "Login")}
          </button>

          <p className="text-sm text-gray-400 text-center">
            {!isRegistering ? "Don't have an account? " : "Already have an account? "}
            <button 
              type="button"
              onClick={() => {
                setIsRegistering(!isRegistering);
                setError(null);
              }}
              className="font-medium text-blue-400 hover:text-blue-300"
            >
              {!isRegistering ? "Create account" : "Login"}
            </button>
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
          onClick={handleDiscordSignIn}
          className="w-full flex items-center justify-center gap-3 bg-[#5865F2] text-white py-3 px-4 rounded-lg hover:bg-[#4752C4] transition-colors"
          disabled={isLoading}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-6 h-6"
            viewBox="0 0 512 365.467"
            shapeRendering="geometricPrecision"
            textRendering="geometricPrecision"
            imageRendering="optimizeQuality"
            fillRule="evenodd"
            clipRule="evenodd"
          >
            <path
              fill="currentColor"
              d="M433.671 0H78.329C35.066 0 0 35.066 0 78.329v208.809c0 43.263 35.066 78.329 78.329 78.329h296.681l-13.851-48.292 33.459 31.093 31.627 29.261L512 448V78.329C512 35.066 476.934 0 433.671 0zM339.051 292.604s-9.397-11.217-17.225-21.082c34.19-9.658 47.262-31.009 47.262-31.009-10.697 7.046-20.876 12.001-30.013 15.411-13.067 5.484-25.589 9.137-37.851 11.217-25.068 4.703-48.043 3.401-67.62-.261-14.89-2.879-27.696-6.806-38.393-11.217-6.024-2.357-12.569-5.223-19.114-8.876-0.782-0.522-1.565-0.782-2.347-1.304-.522-0.261-0.782-0.522-1.043-0.782-4.703-2.618-7.307-4.442-7.307-4.442s12.569 20.876 45.767 30.794c-7.828 9.919-17.486 21.604-17.486 21.604-57.702-1.826-79.619-39.697-79.619-39.697 0-84.061 37.611-152.203 37.611-152.203 37.611-28.217 73.334-27.435 73.334-27.435l2.618 3.14c-47.001 13.589-68.663 34.19-68.663 34.19s5.745-3.14 15.411-7.567c27.957-12.308 50.129-15.672 59.267-16.454 1.565-.261 2.879-.522 4.442-.522 15.933-2.096 33.981-2.618 52.746-.261 24.807 2.879 51.433 10.175 78.576 25.068 0 0-20.615-19.636-65.012-33.198l3.662-4.181s35.723-.782 73.334 27.435c0 0 37.611 68.142 37.611 152.203 0-.261-21.865 37.611-79.619 39.436z"
            />
          </svg>
          Continue with Discord
        </button>

        <WelcomeModal 
          isOpen={showWelcomeModal}
          onClose={handleWelcomeModalClose}
        />
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
          <div className="flex items-center justify-center space-x-4">
            <img
              src="/icon.png"
              alt="BUX Logo"
              width="128"
              height="128"
              className="rounded-lg"
            />
            <h1 className="text-3xl font-bold text-white">BUX Spades</h1>
          </div>
          <div className="text-center text-gray-400">Loading...</div>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
} 