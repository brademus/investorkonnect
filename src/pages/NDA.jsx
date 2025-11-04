import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import NDAModal from "@/components/NDAModal";
import { Shield, ArrowLeft, FileText } from "lucide-react";

export default function NDAPage() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  const handleAccepted = () => {
    setShowModal(false);
    navigate(createPageUrl("Dashboard"));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {showModal && <NDAModal open={showModal} onAccepted={handleAccepted} />}

      <div className="py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-emerald-600 text-white p-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <Shield className="w-8 h-8" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold">Non-Disclosure Agreement</h1>
                  <p className="text-blue-100">Version 1.0 • Effective January 1, 2025</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-8 prose prose-slate max-w-none">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">AgentVault Platform Non-Disclosure Agreement</h2>
              
              <p className="text-slate-700 leading-relaxed mb-6">
                This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault, Inc. ("AgentVault") and the undersigned user ("User") to protect confidential information exchanged through the AgentVault platform.
              </p>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">1. Definition of Confidential Information</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                "Confidential Information" means any and all information exchanged through the AgentVault platform, including but not limited to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
                <li>Property details, addresses, financial information, and investment opportunities</li>
                <li>Investment strategies, deal structures, and financial projections</li>
                <li>Personal information of investors and agents</li>
                <li>Communications between platform users</li>
                <li>Documents shared in deal rooms</li>
                <li>Any information marked as "Confidential" or that reasonably should be understood as confidential</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">2. Obligations of User</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                User agrees to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
                <li>Maintain the confidentiality of all Confidential Information</li>
                <li>Not disclose Confidential Information to any third party without prior written consent</li>
                <li>Use Confidential Information solely for the purpose of conducting transactions through the AgentVault platform</li>
                <li>Take reasonable measures to protect Confidential Information from unauthorized disclosure</li>
                <li>Notify AgentVault immediately of any unauthorized disclosure or use</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">3. Exceptions</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                This Agreement does not apply to information that:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-700 mb-6">
                <li>Is or becomes publicly available through no breach of this Agreement</li>
                <li>Was rightfully possessed by User prior to disclosure</li>
                <li>Is independently developed by User without use of Confidential Information</li>
                <li>Is required to be disclosed by law or court order (with prior notice to AgentVault)</li>
              </ul>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">4. Term and Termination</h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                This Agreement begins upon User's acceptance and continues for a period of five (5) years. User's obligations regarding Confidential Information survive termination of this Agreement and User's use of the platform.
              </p>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">5. Remedies</h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                User acknowledges that breach of this Agreement may cause irreparable harm to AgentVault and other platform users. AgentVault shall be entitled to seek injunctive relief and monetary damages for any breach, in addition to all other available remedies at law or in equity.
              </p>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">6. Audit Trail</h3>
              <p className="text-slate-700 leading-relaxed mb-6">
                User acknowledges that all platform activities are logged with timestamps and IP addresses. These audit trails may be used as evidence in any dispute regarding breach of this Agreement.
              </p>

              <h3 className="text-xl font-bold text-slate-900 mt-8 mb-4">7. General Provisions</h3>
              <p className="text-slate-700 leading-relaxed mb-4">
                This Agreement shall be governed by the laws of Delaware. If any provision is found unenforceable, the remaining provisions shall remain in full effect. This Agreement constitutes the entire agreement regarding confidentiality obligations.
              </p>

              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mt-8">
                <h4 className="font-bold text-blue-900 mb-3 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  User Acknowledgment
                </h4>
                <p className="text-blue-800 text-sm mb-4">
                  By clicking "Agree & Continue," User acknowledges that they have read, understood, and agree to be bound by the terms of this Non-Disclosure Agreement. User's acceptance will be recorded with a timestamp and IP address for audit purposes.
                </p>
                <Button 
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Agree to NDA
                </Button>
              </div>

              <div className="mt-8 text-sm text-slate-500 border-t border-slate-200 pt-6">
                <p>
                  <strong>Document Information:</strong><br />
                  Version: 1.0<br />
                  Effective Date: January 1, 2025<br />
                  Last Updated: January 1, 2025
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}