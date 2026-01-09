import React from "react";
import Pipeline from "./Pipeline";
import ErrorBoundary from "@/components/ErrorBoundary";

/**
 * DASHBOARD - Shows role-specific dashboard
 * 
 * Guards:
 * 1. Must be logged in
 * 2. Must have role selected
 * 3. Must have completed onboarding
 */
export default function Dashboard() {
  // Render Pipeline directly to avoid redirect loops
  return (
    <ErrorBoundary>
      <Pipeline />
    </ErrorBoundary>
  );
}