"use client";

import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

export default function AuthTestPage() {
  const { data: session, status } = useSession();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-white text-center">Auth Test Page</h1>
        
        <div className="text-white space-y-4">
          <div>
            <strong>Session Status:</strong> {status}
          </div>
          
          <div>
            <strong>Session Data:</strong>
            <pre className="bg-gray-700 p-2 rounded mt-1 overflow-auto max-h-40">
              {JSON.stringify(session, null, 2)}
            </pre>
          </div>
          
          <div>
            <strong>User ID:</strong> {session?.user?.id || "Not authenticated"}
          </div>
          
          <div>
            <strong>User Name:</strong> {session?.user?.name || "Not authenticated"}
          </div>
          
          <div>
            <strong>User Email:</strong> {session?.user?.email || "Not authenticated"}
          </div>
        </div>
        
        <div className="flex justify-center">
          <a 
            href="/login" 
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Go to Login
          </a>
        </div>
      </div>
    </div>
  );
} 