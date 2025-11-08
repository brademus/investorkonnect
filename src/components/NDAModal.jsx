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
import { Shield, Lock, FileText, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NDAModal({ open, onAccepted }) {
  const [agreed, setAgreed] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    setAccepting(true);
    try {
      const response = await base44.functions.invoke('ndaAccept');
      
      if (response.data.ok) {
        toast.success("NDA accepted successfully!");
        onAccepted();
      } else {
        toast.error("Failed to accept NDA");
      }
    } catch (error) {
      console.error('NDA accept error:', error);
      toast.error("Failed to accept NDA. Please try again.");
    } finally {
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

        <div className="bg-slate-50 rounded-xl p-6 max-h-96 overflow-y-auto border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4">AgentVault Non-Disclosure Agreement v1.0</h3>
          
          <div className="prose prose-sm text-slate-700 space-y-4">
            <p>
              This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault ("Platform") and you ("User").
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
            id="nda-agree"
            checked={agreed}
            onCheckedChange={setAgreed}
            className="mt-1"
          />
          <Label htmlFor="nda-agree" className="text-sm text-slate-700 cursor-pointer leading-relaxed">
            I have read and agree to the terms of this Non-Disclosure Agreement. I understand that this is a legally 
            binding contract and that I am responsible for maintaining confidentiality of all information accessed through AgentVault.
          </Label>
        </div>

        <div className="flex gap-3 mt-6">
          <Button
            onClick={handleAccept}
            disabled={!agreed || accepting}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
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
          Questions? Contact <a href="mailto:legal@agentvault.com" className="text-blue-600 hover:text-blue-700">legal@agentvault.com</a>
        </p>
      </DialogContent>
    </Dialog>
  );
}