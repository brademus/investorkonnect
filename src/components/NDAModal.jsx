import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Shield, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NDAModal({ open = true, onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please check the agreement box to continue");
      return;
    }

    setSubmitting(true);

    try {
      const response = await base44.functions.invoke('ndaAccept', {});
      
      if (response.data?.success) {
        toast.success("NDA accepted successfully!");
        if (onAccepted) {
          onAccepted();
        }
      } else {
        throw new Error(response.data?.error || "Failed to accept NDA");
      }
    } catch (error) {
      console.error('[NDAModal] Accept error:', error);
      toast.error(error.message || "Failed to accept NDA. Please try again.");
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <DialogTitle className="text-2xl">Confidentiality & NDA Required</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            Access to verified agents and deal rooms requires your acceptance of our Non-Disclosure Agreement.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 my-6">
          <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
            <h3 className="font-semibold text-slate-900 mb-3">Why We Require an NDA</h3>
            <ul className="space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Protects confidential deal information shared between investors and agents</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Prevents unauthorized disclosure of property details, investment strategies, and financial information</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Creates a legally binding obligation to maintain confidentiality</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-1">•</span>
                <span>Establishes trust and professionalism in all platform interactions</span>
              </li>
            </ul>
          </div>

          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <h3 className="font-semibold text-blue-900 mb-2">Key Terms</h3>
            <p className="text-sm text-blue-800 mb-3">
              By signing this NDA, you agree to:
            </p>
            <ul className="space-y-1.5 text-sm text-blue-800">
              <li>• Maintain confidentiality of all deal information</li>
              <li>• Not share protected information with third parties</li>
              <li>• Use information solely for platform-facilitated transactions</li>
              <li>• Acknowledge that violations may result in legal action</li>
            </ul>
          </div>

          <div className="text-center">
            <a 
              href="/pages/NDA" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View Full NDA Document
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
        </div>

        <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 mb-6">
          <div className="flex items-start gap-3">
            <Checkbox
              id="nda-agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              disabled={submitting}
              className="mt-1"
            />
            <Label
              htmlFor="nda-agree"
              className="text-sm text-slate-700 cursor-pointer leading-relaxed"
            >
              I have read and agree to the AgentVault Non-Disclosure Agreement (v1.0). 
              I understand that all information accessed through this platform is confidential 
              and protected, and I agree to maintain its confidentiality.
            </Label>
          </div>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={handleAccept}
            disabled={!agreed || submitting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 h-12"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                Agree & Continue
              </>
            )}
          </Button>
        </div>

        <p className="text-xs text-slate-500 text-center mt-4">
          Your acceptance will be recorded with timestamp and IP address for audit purposes.
        </p>
      </DialogContent>
    </Dialog>
  );
}