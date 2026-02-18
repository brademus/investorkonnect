import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";

export default function Home() {
  const navigate = useNavigate();

  React.useEffect(() => {
    navigate(createPageUrl("RoleLanding"), { replace: true });
  }, [navigate]);

  return null;
}