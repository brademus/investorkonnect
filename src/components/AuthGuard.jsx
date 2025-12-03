import React from "react";
import { Loader2 } from "lucide-react";

/**
 * AUTH GUARD - Simple wrapper that shows loading state
 * 
 * Individual pages handle their own auth/routing logic.
 * This is kept for backward compatibility but doesn't redirect.
 */
export function AuthGuard({ children }) {
  return <>{children}</>;
}

export default AuthGuard;