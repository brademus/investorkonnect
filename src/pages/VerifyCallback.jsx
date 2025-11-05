import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * DEPRECATED - No longer needed with embedded flow
 * Old flow used callbacks after Persona redirect, now we handle everything inline
 */
export default function VerifyCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to new embedded verification page
    navigate(createPageUrl("Verify"), { replace: true });
  }, [navigate]);

  return null;
}