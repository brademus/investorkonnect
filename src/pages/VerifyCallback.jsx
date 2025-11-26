import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";

/**
 * DEPRECATED - Old verification callback
 * Now redirects to new embedded verification
 */
export default function VerifyCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate(createPageUrl("Verify"), { replace: true });
  }, [navigate]);

  return null;
}