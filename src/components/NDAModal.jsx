import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { ndaAccept } from "@/components/functions";
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
import { Shield, Lock, FileText, Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

/**
 * NDAModal - Modal version for inline NDA acceptance
 * Used on pages like /agents, /deal-rooms where NDA is required
 * Calls same backend as full NDA page
 */
export default function NDAModal({ open, onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState(null);

  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    console.log('[NDAModal] Accepting NDA...');
    setAccepting(true);
    setError(null);

    try {
      console.log('[NDAModal] Calling ndaAccept function...');
      // Directly update profile via SDK instead of function (KYC removed)
      const me = await base44.auth.me();
      const emailLower = me.email.toLowerCase().trim();
      let profiles = await base44.entities.Profile.filter({ email: emailLower });
      if (!profiles || profiles.length === 0) {
        profiles = await base44.entities.Profile.filter({ user_id: me.id });
      }
      const profile = profiles[0];
      if (!profile) throw new Error('Profile not found');

      await base44.entities.Profile.update(profile.id, {
        nda_accepted: true,
        nda_accepted_at: new Date().toISOString(),
        nda_version: 'v1.0'
      });

      console.log('[NDAModal] ✅ NDA accepted successfully');
      
      if (true) {
        console.log('[NDAModal] ✅ NDA accepted successfully');
        toast.success("NDA accepted successfully!");
        
        // Call parent callback to refresh and close modal
        if (onAccepted) {
          onAccepted();
        }
      } else {
        const errorMsg = "Failed to accept NDA";
        console.error('[NDAModal] ❌ Error:', errorMsg);
        setError(errorMsg);
        toast.error(errorMsg);
        setAccepting(false);
      }
    } catch (error) {
      console.error('[NDAModal] ❌ Exception:', error);
      const errorMsg = error.message || "Failed to accept NDA. Please try again.";
      setError(errorMsg);
      toast.error(errorMsg);
      setAccepting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-2xl">Non-Disclosure Agreement</DialogTitle>
              <DialogDescription>
                Required to access agent profiles and deal rooms
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 my-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <Lock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Deal Protection</h4>
            <p className="text-xs text-slate-600">Information legally protected</p>
          </div>
          <div className="bg-emerald-50 rounded-lg p-4 text-center">
            <FileText className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 mb-1">Enforceable</h4>
            <p className="text-xs text-slate-600">Legally binding contract</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <Shield className="w-6 h-6 text-purple-600 mx-auto mb-2" />
            <h4 className="font-semibold text-sm text-slate-900 mb-1">One-Time</h4>
            <p className="text-xs text-slate-600">Accept once, valid forever</p>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-900 mb-1">Error</h4>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-slate-50 rounded-xl p-6 max-h-96 overflow-y-auto border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Investor Konnect Non-Disclosure Agreement v1.0</h3>
          
          <div className="prose prose-sm text-slate-700 space-y-4">
            <p>
              This Non-Disclosure Agreement ("Agreement") is entered into by and between Investor Konnect ("Platform") and you ("User").
            </p>
            
            <h4 className="font-semibold text-slate-900">1. Confidential Information</h4>
            <p>
              "Confidential Information" means all deal information, property details, investment strategies, financial information, 
              agent contact details, and any other information shared through the Platform that is marked as confidential or would 
              reasonably be considered confidential.
            </p>
            
            <h4 className="font-semibold text-slate-900">2. Obligations</h4>
            <p>User agrees to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain confidentiality of all Confidential Information</li>
              <li>Use Confidential Information only for legitimate real estate investment purposes</li>
              <li>Not share, copy, or distribute Confidential Information without written consent</li>
              <li>Notify Platform immediately of any unauthorized disclosure</li>
              <li>Return or destroy Confidential Information upon request</li>
            </ul>
            
            <h4 className="font-semibold text-slate-900">3. Term</h4>
            <p>
              This Agreement remains in effect for 5 years from the date of acceptance or until Confidential Information 
              becomes publicly available through no fault of User.
            </p>
            
            <h4 className="font-semibold text-slate-900">4. Exceptions</h4>
            <p>
              Obligations do not apply to information that: (a) is publicly available; (b) was rightfully known prior to disclosure; 
              (c) is independently developed; or (d) must be disclosed by law.
            </p>
            
            <h4 className="font-semibold text-slate-900">5. Remedies</h4>
            <p>
              User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users. 
              Platform may seek injunctive relief, monetary damages, and attorney fees for any breach.
            </p>
            
            <h4 className="font-semibold text-slate-900">6. Governing Law</h4>
            <p>
              This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
            
            <h4 className="font-semibold text-slate-900">7. Entire Agreement</h4>
            <p>
              This Agreement constitutes the entire agreement between parties regarding confidentiality obligations and supersedes 
              all prior agreements.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 mt-6">
          <Checkbox
            id="nda-agree-modal"
            checked={agreed}
            onCheckedChange={setAgreed}
            className="mt-1"
            disabled={accepting}
          />
          <Label htmlFor="nda-agree-modal" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
            I have read and agree to the terms of this Non-Disclosure Agreement. I understand that this is a legally 
            binding contract and that I am responsible for maintaining confidentiality of all information accessed through Investor Konnect.
          </Label>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleAccept}
            disabled={!agreed || accepting}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {accepting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Accepting...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4 mr-2" />
                I Accept
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          Questions? Contact <a href="mailto:legal@investorkonnect.com" className="text-blue-600 hover:text-blue-700">legal@investorkonnect.com</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}