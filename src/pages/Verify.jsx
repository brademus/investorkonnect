import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";

export default function Verify() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("Dashboard"), { replace: true });
  }, [navigate]);
  return null;
}