"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import WelcomeModal from "@/components/WelcomeModal";
import { FaEye, FaEyeSlash } from "react-icons/fa";

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please enter both username and password.");
      return;
    }
    
    if (isRegistering && !email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    try {
      if (isRegistering) {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            username,
            password,
            email,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Registration failed');
        }

        // Show welcome modal after successful registration
        setShowWelcomeModal(true);

        // If registration successful, log them in
        const result = await signIn("credentials", {
          redirect: false,
          username: email, // Use email for first login after registration
          password,
        });
        
        if (result?.error) {
          throw new Error('Failed to log in after registration');
        }
        // Don't redirect yet, wait for welcome modal to close
        setIsLoading(false);
      } else {
        const result = await signIn("credentials", {
          redirect: false,
          username,
          password,
          callbackUrl: "/game"
        });

        if (result?.error) {
          setError("Invalid username or password.");
          setIsLoading(false);
        } else if (result?.url) {
          window.location.href = result.url;
        } else {
          setError("An unexpected error occurred during login.");
          setIsLoading(false);
        }
      }
    } catch (err) {
      console.error(isRegistering ? "Registration error:" : "Login error:", err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred.");
      setIsLoading(false);
    }
  };

  const handleDiscordSignIn = () => {
    // Initiate Discord sign in without showing welcome modal first
    signIn("discord", { 
      callbackUrl: "/game",
      redirect: true
    });
  };

  const handleWelcomeModalClose = () => {
    setShowWelcomeModal(false);
    window.location.href = "/game";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
        <div className="flex items-center justify-center space-x-4">
          <svg 
            width="128" 
            height="128" 
            viewBox="0 0 256 256" 
            className="rounded-lg"
          >
            <path d="M0 0 C71.94 0 143.88 0 218 0 C214 5 214 5 211.75 5.8125 C211.1725 5.874375 210.595 5.93625 210 6 C210.33 7.32 210.66 8.64 211 10 C210.34 10 209.68 10 209 10 C209 9.34 209 8.68 209 8 C208.195625 7.62875 208.195625 7.62875 207.375 7.25 C204.43575748 5.70303025 201.74245592 3.86985631 199 2 C198.67 4.31 198.34 6.62 198 9 C197.34 9 196.68 9 196 9 C196 10.32 196 11.64 196 13 C195.34 13 194.68 13 194 13 C196.01994819 24.38300216 199.60354643 33.96715772 205.15234375 44.10546875 C206 46 206 46 206 49 C206.66 49 207.32 49 208 49 C211 54.75 211 54.75 211 57 C211.99 57.33 212.98 57.66 214 58" fill="#081F03" transform="translate(36,0)"/>
            <path d="M0 0 C1 1 1 1 1.09765625 3.06640625 C1.08605469 3.89011719 1.07445313 4.71382812 1.0625 5.5625 C1.05347656 6.38878906 1.04445313 7.21507812 1.03515625 8.06640625 C1.02355469 8.70449219 1.01195313 9.34257813 1 10 C3.475 9.505 3.475 9.505 6 9 C3.83595673 11.40449252 2.4027007 12.85952301 -0.6875 13.9375 C-1.450625 14.288125 -2.21375 14.63875 -3 15 C-3.89386164 17.54775306 -3.89386164 17.54775306 -4 20" fill="#712400" transform="translate(122,29)"/>
            <path d="M0 0 C24.42 0 48.84 0 74 0 C74 0.33 74 0.66 74 1 C73.35933594 1.04898438 72.71867187 1.09796875 72.05859375 1.1484375 C66.78803915 1.6040145 62.03013712 2.3597379 57 4 C56.505 3.505 56.505 3.505 56 3 C55.67 3.66 55.34 4.32 55 5" fill="#EEEB00" transform="translate(122,29)"/>
          </svg>
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
              d="M378.186 365.028s-15.794-18.865-28.956-35.099c57.473-16.232 79.41-51.77 79.41-51.77-17.989 11.846-35.099 20.182-50.454 25.885-21.938 9.213-42.997 14.917-63.617 18.866-42.118 7.898-80.726 5.703-113.631-.438-25.008-4.827-46.506-11.407-64.494-18.867-10.091-3.947-21.059-8.774-32.027-14.917-1.316-.877-2.633-1.316-3.948-2.193-.877-.438-1.316-.878-1.755-.878-7.898-4.388-12.285-7.458-12.285-7.458s21.06 34.659 76.779 51.331c-13.163 16.673-29.395 35.977-29.395 35.977C36.854 362.395 0 299.218 0 299.218 0 159.263 63.177 45.633 63.177 45.633 126.354-1.311 186.022.005 186.022.005l4.388 5.264C111.439 27.645 75.461 62.305 75.461 62.305s9.653-5.265 25.886-12.285c46.945-20.621 84.236-25.885 99.592-27.64 2.633-.439 4.827-.878 7.458-.878 26.763-3.51 57.036-4.387 88.624-.878 41.68 4.826 86.43 17.111 132.058 41.68 0 0-34.66-32.906-109.244-55.281l6.143-7.019s60.105-1.317 122.844 45.628c0 0 63.178 113.631 63.178 253.585 0-.438-36.854 62.739-133.813 65.81l-.001.001zm-43.874-203.133c-25.006 0-44.75 21.498-44.75 48.262 0 26.763 20.182 48.26 44.75 48.26 25.008 0 44.752-21.497 44.752-48.26 0-26.764-20.182-48.262-44.752-48.262zm-160.135 0c-25.008 0-44.751 21.498-44.751 48.262 0 26.763 20.182 48.26 44.751 48.26 25.007 0 44.75-21.497 44.75-48.26.439-26.763-19.742-48.262-44.75-48.262z"
            />
          </svg>
          Sign in with Discord
        </button>
      </div>

      <WelcomeModal 
        isOpen={showWelcomeModal} 
        onClose={handleWelcomeModalClose}
      />
    </div>
  );
} 