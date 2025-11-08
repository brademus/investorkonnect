import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/**
 * DEPRECATED - Old hosted verification flow
 * Now redirects to new embedded verification
 */
export default function VerifyStart() {
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect to new embedded flow
    navigate(createPageUrl("Verify"), { replace: true });
  }, [navigate]);

  return null;
}