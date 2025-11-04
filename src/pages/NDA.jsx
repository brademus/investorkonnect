import React, { useState } from "react";
import { Shield, FileText, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import NDAModal from "@/components/NDAModal";
import { useCurrentProfile } from "@/components/useCurrentProfile";

export default function NDA() {
  const [showModal, setShowModal] = useState(false);
  const { profile, refresh } = useCurrentProfile();

  const handleAccepted = () => {
    setShowModal(false);
    refresh();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12">
      {showModal && <NDAModal open={showModal} onAccepted={handleAccepted} />}
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Non-Disclosure Agreement</h1>
          </div>

          {profile?.nda_accepted && (
            <div className="mb-8 bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">You have signed this NDA</p>
                  <p className="text-sm text-emerald-700">
                    Accepted on {new Date(profile.nda_accepted_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

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

          <div className="prose prose-slate max-w-none">
            <h3 className="text-lg font-bold text-slate-900 mb-4">AgentVault Non-Disclosure Agreement v1.0</h3>
            
            <p className="text-sm text-slate-600 mb-6">Last Updated: January 1, 2025</p>

            <p>
              This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault ("Platform") and you ("User").
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">1. Confidential Information</h4>
            <p>
              "Confidential Information" means all deal information, property details, investment strategies, financial information, 
              agent contact details, and any other information shared through the Platform that is marked as confidential or would 
              reasonably be considered confidential.
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">2. Obligations</h4>
            <p>User agrees to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Maintain confidentiality of all Confidential Information</li>
              <li>Use Confidential Information only for legitimate real estate investment purposes</li>
              <li>Not share, copy, or distribute Confidential Information without written consent</li>
              <li>Notify Platform immediately of any unauthorized disclosure</li>
              <li>Return or destroy Confidential Information upon request</li>
            </ul>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">3. Term</h4>
            <p>
              This Agreement remains in effect for 5 years from the date of acceptance or until Confidential Information 
              becomes publicly available through no fault of User.
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">4. Exceptions</h4>
            <p>
              Obligations do not apply to information that: (a) is publicly available; (b) was rightfully known prior to disclosure; 
              (c) is independently developed; or (d) must be disclosed by law.
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">5. Remedies</h4>
            <p>
              User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users. 
              Platform may seek injunctive relief, monetary damages, and attorney fees for any breach.
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">6. Governing Law</h4>
            <p>
              This Agreement is governed by the laws of the State of Delaware, without regard to conflict of law principles.
            </p>
            
            <h4 className="font-semibold text-slate-900 mt-6 mb-3">7. Entire Agreement</h4>
            <p>
              This Agreement constitutes the entire agreement between parties regarding confidentiality obligations and supersedes 
              all prior agreements.
            </p>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-6 mt-8">
              <h4 className="font-semibold text-slate-900 mb-3">Contact Information</h4>
              <p className="text-sm text-slate-700">
                Questions about this NDA? Contact us at:<br />
                <strong>Email:</strong> legal@agentvault.com<br />
                <strong>Address:</strong> 123 Main Street, San Francisco, CA 94102
              </p>
            </div>
          </div>

          {!profile?.nda_accepted && profile?.user && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="text-center">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Ready to Accept?</h3>
                <p className="text-slate-600 mb-6">
                  Click below to accept this NDA and gain access to protected features
                </p>
                <Button 
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Accept NDA
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}