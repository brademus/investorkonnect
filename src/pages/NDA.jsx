import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, FileText, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function NDA() {
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [signing, setSigning] = useState(false);

  const handleSign = async () => {
    if (!agreed) {
      toast.error("Please read and agree to the NDA terms");
      return;
    }

    setSigning(true);
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.Profile.filter({ created_by: user.email });
      
      if (profiles.length > 0) {
        const profile = profiles[0];
        
        // Create NDA record
        await base44.entities.NDA.create({
          user_id: profile.id,
          user_email: user.email,
          status: "signed",
          signed_at: new Date().toISOString(),
          ip_address: "xxx.xxx.xxx.xxx"
        });
        
        // Update profile verification
        await base44.entities.Profile.update(profile.id, {
          verification_nda: true
        });
        
        toast.success("NDA signed successfully!");
        navigate(createPageUrl("Dashboard"));
      }
    } catch (error) {
      console.error("NDA signing error:", error);
      toast.error("Failed to sign NDA. Please try again.");
    } finally {
      setSigning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Shield className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Non-Disclosure Agreement</h1>
          <p className="text-slate-600">Protect your deal information and access verified agents</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8 mb-6 border border-slate-200">
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="text-center">
              <Lock className="w-8 h-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Deal Protection</h3>
              <p className="text-sm text-slate-600">Your information is legally protected</p>
            </div>
            <div className="text-center">
              <FileText className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Enforceable</h3>
              <p className="text-sm text-slate-600">Legally binding contract</p>
            </div>
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-semibold text-slate-900 mb-2">Required Access</h3>
              <p className="text-sm text-slate-600">Needed for deal rooms & profiles</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-xl p-6 max-h-96 overflow-y-auto border border-slate-200 mb-6">
            <h2 className="text-lg font-bold text-slate-900 mb-4">AgentVault Non-Disclosure Agreement</h2>
            
            <div className="prose prose-sm text-slate-700 space-y-4">
              <p>
                This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault ("Platform") and you ("User").
              </p>
              
              <h3 className="font-semibold text-slate-900">1. Confidential Information</h3>
              <p>
                "Confidential Information" means all deal information, property details, investment strategies, financial information, 
                agent contact details, and any other information shared through the Platform that is marked as confidential or would 
                reasonably be considered confidential.
              </p>
              
              <h3 className="font-semibold text-slate-900">2. Obligations</h3>
              <p>
                User agrees to:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Maintain confidentiality of all Confidential Information</li>
                <li>Use Confidential Information only for legitimate real estate investment purposes</li>
                <li>Not share, copy, or distribute Confidential Information without written consent</li>
                <li>Notify Platform immediately of any unauthorized disclosure</li>
              </ul>
              
              <h3 className="font-semibold text-slate-900">3. Term</h3>
              <p>
                This Agreement remains in effect for 5 years from the date of signing or until Confidential Information 
                becomes publicly available through no fault of User.
              </p>
              
              <h3 className="font-semibold text-slate-900">4. Remedies</h3>
              <p>
                User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users. 
                Platform may seek injunctive relief, monetary damages, and attorney fees for any breach.
              </p>
              
              <h3 className="font-semibold text-slate-900">5. Entire Agreement</h3>
              <p>
                This Agreement constitutes the entire agreement between parties regarding confidentiality obligations.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 mb-6">
            <Checkbox
              id="agree"
              checked={agreed}
              onCheckedChange={setAgreed}
              className="mt-1"
            />
            <label htmlFor="agree" className="text-sm text-slate-700 cursor-pointer">
              I have read and agree to the terms of this Non-Disclosure Agreement. I understand that this is a legally 
              binding contract and that I am responsible for maintaining confidentiality of all information accessed through AgentVault.
            </label>
          </div>

          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSign}
              disabled={!agreed || signing}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {signing ? "Signing..." : "Sign NDA"}
            </Button>
          </div>
        </div>

        <p className="text-center text-sm text-slate-600">
          Questions about this agreement? <a href="mailto:legal@agentvault.com" className="text-blue-600 hover:text-blue-700">Contact legal@agentvault.com</a>
        </p>
      </div>
    </div>
  );
}