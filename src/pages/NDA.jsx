import React, { useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import NDAModal from "@/components/NDAModal";
import { Shield, CheckCircle, FileText, Lock, ArrowLeft } from "lucide-react";

export default function NDAPage() {
  const [showModal, setShowModal] = useState(false);
  const [accepted, setAccepted] = useState(false);

  const handleAccepted = () => {
    setShowModal(false);
    setAccepted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      {showModal && <NDAModal open={showModal} onAccepted={handleAccepted} />}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <Link to={createPageUrl("Home")} className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          {/* Header */}
          <div className="flex items-start gap-4 mb-8 pb-8 border-b border-slate-200">
            <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-900 mb-2">
                Non-Disclosure Agreement
              </h1>
              <p className="text-slate-600">
                Required to access agent profiles, deal rooms, and confidential information
              </p>
            </div>
          </div>

          {/* Key Points */}
          <div className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-blue-50 rounded-lg p-4 text-center">
              <Lock className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Deal Protection</h4>
              <p className="text-xs text-slate-600">Legally binding confidentiality</p>
            </div>
            <div className="bg-emerald-50 rounded-lg p-4 text-center">
              <FileText className="w-6 h-6 text-emerald-600 mx-auto mb-2" />
              <h4 className="font-semibold text-sm text-slate-900 mb-1">Enforceable</h4>
              <p className="text-xs text-slate-600">Legal contract with remedies</p>
            </div>
            <div className="bg-purple-50 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <h4 className="font-semibold text-sm text-slate-900 mb-1">One-Time</h4>
              <p className="text-xs text-slate-600">Accept once, valid forever</p>
            </div>
          </div>

          {/* Accept Button - Top */}
          {accepted ? (
            <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <div>
                  <p className="font-semibold text-emerald-900">NDA Accepted</p>
                  <p className="text-sm text-emerald-700">You can now access protected content</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6 mb-8">
              <p className="text-sm text-slate-700 mb-4">
                By clicking "Agree & Continue" below, you accept the terms of this Non-Disclosure Agreement
                and can proceed to access agent profiles and deal rooms.
              </p>
              <Button 
                onClick={() => setShowModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Shield className="w-4 h-4 mr-2" />
                Agree & Continue
              </Button>
            </div>
          )}

          {/* Full NDA Text */}
          <div className="prose prose-slate max-w-none">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">
              AgentVault Non-Disclosure Agreement v1.0
            </h2>
            
            <p className="text-slate-700 leading-relaxed">
              This Non-Disclosure Agreement ("Agreement") is entered into by and between AgentVault 
              ("Platform") and you ("User").
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">1. Confidential Information</h3>
            <p className="text-slate-700 leading-relaxed">
              "Confidential Information" means all deal information, property details, investment strategies, 
              financial information, agent contact details, and any other information shared through the Platform 
              that is marked as confidential or would reasonably be considered confidential.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">2. Obligations</h3>
            <p className="text-slate-700 leading-relaxed mb-2">User agrees to:</p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>Maintain confidentiality of all Confidential Information</li>
              <li>Use Confidential Information only for legitimate real estate investment purposes</li>
              <li>Not share, copy, or distribute Confidential Information without written consent</li>
              <li>Notify Platform immediately of any unauthorized disclosure</li>
              <li>Return or destroy Confidential Information upon request</li>
              <li>Not attempt to circumvent Platform protections or access controls</li>
              <li>Not use Confidential Information for competitive purposes</li>
            </ul>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">3. Term</h3>
            <p className="text-slate-700 leading-relaxed">
              This Agreement remains in effect for 5 years from the date of acceptance or until Confidential 
              Information becomes publicly available through no fault of User, whichever is longer.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">4. Exceptions</h3>
            <p className="text-slate-700 leading-relaxed mb-2">
              Obligations do not apply to information that:
            </p>
            <ul className="list-disc pl-6 space-y-2 text-slate-700">
              <li>(a) is or becomes publicly available through no breach of this Agreement;</li>
              <li>(b) was rightfully known to User prior to disclosure;</li>
              <li>(c) is independently developed by User without use of Confidential Information;</li>
              <li>(d) must be disclosed pursuant to applicable law or court order, provided User notifies Platform in advance;</li>
              <li>(e) is approved for release by written authorization from Platform.</li>
            </ul>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">5. Remedies</h3>
            <p className="text-slate-700 leading-relaxed">
              User acknowledges that breach of this Agreement may cause irreparable harm to Platform and other users 
              for which monetary damages alone would be inadequate. Platform may seek injunctive relief, specific 
              performance, monetary damages, and attorney fees for any breach. User waives any requirement that 
              Platform post a bond or other security.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">6. No License</h3>
            <p className="text-slate-700 leading-relaxed">
              This Agreement does not grant User any license or right to use Platform's intellectual property, 
              trademarks, or confidential information except as explicitly permitted for the intended purpose.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">7. Platform Audit Rights</h3>
            <p className="text-slate-700 leading-relaxed">
              Platform reserves the right to audit User's compliance with this Agreement. All activities on the 
              Platform are logged for security and compliance purposes.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">8. Governing Law</h3>
            <p className="text-slate-700 leading-relaxed">
              This Agreement is governed by the laws of the State of Delaware, United States, without regard to 
              conflict of law principles. Any disputes shall be resolved in the state or federal courts located 
              in Delaware.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">9. Severability</h3>
            <p className="text-slate-700 leading-relaxed">
              If any provision of this Agreement is found to be unenforceable, the remaining provisions shall 
              remain in full force and effect.
            </p>
            
            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">10. Entire Agreement</h3>
            <p className="text-slate-700 leading-relaxed">
              This Agreement constitutes the entire agreement between parties regarding confidentiality obligations 
              and supersedes all prior agreements and understandings, whether written or oral.
            </p>

            <h3 className="text-xl font-semibold text-slate-900 mt-6 mb-3">11. Amendments</h3>
            <p className="text-slate-700 leading-relaxed">
              Platform may update this Agreement by posting a new version. Continued use of the Platform after 
              such update constitutes acceptance of the new terms.
            </p>

            <div className="bg-slate-50 rounded-lg p-6 mt-8 border-2 border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-2">Contact Information</h4>
              <p className="text-sm text-slate-700">
                Questions about this NDA? Contact us at{' '}
                <a href="mailto:legal@agentvault.com" className="text-blue-600 hover:text-blue-700 font-medium">
                  legal@agentvault.com
                </a>
              </p>
            </div>
          </div>

          {/* Accept Button - Bottom */}
          {!accepted && (
            <div className="mt-8 pt-8 border-t border-slate-200">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
                <p className="text-sm text-slate-700 mb-4">
                  By clicking "Agree & Continue", you acknowledge that you have read and understood this 
                  Non-Disclosure Agreement and agree to be bound by its terms.
                </p>
                <Button 
                  onClick={() => setShowModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  I Agree to this NDA
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}