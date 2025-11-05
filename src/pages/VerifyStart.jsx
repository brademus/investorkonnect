import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * DEPRECATED - Redirects to new embedded verification flow
 * Old flow used hosted Persona links, now we use embedded widget
 */
export default function VerifyStart() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to new embedded verification page
    navigate(createPageUrl("Verify"), { replace: true });
  }, [navigate]);

  return null;
}