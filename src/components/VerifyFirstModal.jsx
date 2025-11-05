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

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl">Identity Verification Required</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            To access NDA-protected content, we need to verify your identity first.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-6">
          <div className="bg-blue-50 rounded-lg p-6 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-3">Why We Verify Identity</h3>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Prevents fraud and protects all platform users</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Required before accessing confidential deal information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Ensures legal accountability for NDA compliance</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>One-time process powered by Persona (industry standard)</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3">What You'll Need</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FileCheck className="w-4 h-4 text-slate-600" />
                <span>Government-issued ID</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <FileCheck className="w-4 h-4 text-slate-600" />
                <span>Your address</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>Takes 2-3 minutes</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-700">
                <Lock className="w-4 h-4 text-slate-600" />
                <span>Bank-level security</span>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> This is a one-time verification. Once approved, you'll have permanent access to protected content.
            </p>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleVerify}
            className="flex-1 bg-blue-600 hover:bg-blue-700 h-12"
          >
            <Shield className="w-4 h-4 mr-2" />
            Verify Now
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          Verification powered by Persona. Your data is encrypted and never shared with third parties.
        </p>
      </DialogContent>
    </Dialog>
  );
}