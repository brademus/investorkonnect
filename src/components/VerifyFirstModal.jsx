import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, CheckCircle, Lock, FileCheck } from "lucide-react";

export default function VerifyFirstModal({ open = true }) {
  const navigate = useNavigate();

  const handleVerify = () => {
    // UPDATED - Navigate to new embedded verification page
    navigate(createPageUrl("Verify"));
  };

  return null;
}