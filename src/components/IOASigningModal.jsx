import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Shield, CheckCircle, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * IOA Signing Modal
 * Allows investor or agent to sign the Internal Operating Agreement
 * After both parties sign, sensitive deal information is unlocked
 */
export default function IOASigningModal({ deal, profile, open, onClose, onSuccess }) {
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);

  if (!deal || !profile) return null;

  const userRole = profile.user_role;
  const isInvestor = userRole === 'investor';
  const isAgent = userRole === 'agent';

  // Check current signature status
  const investorSigned = !!deal.ioa_investor_signed_at;
  const agentSigned = !!deal.ioa_agent_signed_at;
  const currentUserSigned = isInvestor ? investorSigned : agentSigned;
  const bothSigned = investorSigned && agentSigned;

  const handleSign = async () => {
    if (!agreed) {
      toast.error('Please agree to the terms before signing');
      return;
    }

    setSigning(true);
    try {
      const action = isInvestor ? 'investor_sign' : 'agent_sign';
      const response = await base44.functions.invoke('signIOA', {
        dealId: deal.id,
        action
      });

      if (response.data?.success) {
        toast.success('IOA signed successfully!');
        if (response.data.info_unlocked) {
          toast.success('🔓 Full deal details now unlocked!', { duration: 5000 });
        }
        onSuccess?.();
        onClose();
      } else {
        throw new Error(response.data?.error || 'Failed to sign IOA');
      }
    } catch (error) {
      console.error('IOA signing error:', error);
      toast.error(error.message || 'Failed to sign IOA');
    } finally {
      setSigning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-[#E3C567] flex items-center gap-2">
            <Shield className="w-6 h-6" />
            Internal Operating Agreement (IOA)
          </DialogTitle>
          <DialogDescription className="text-[#808080]">
            Sign to unlock full deal details and proceed with this transaction
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Current Status */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
            <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">Signature Status</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {investorSigned ? (
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <div className="w-4 h-4 border-2 border-[#808080] rounded-full" />
                )}
                <span className={investorSigned ? 'text-[#10B981]' : 'text-[#808080]'}>
                  Investor {investorSigned ? 'Signed' : 'Not Signed'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {agentSigned ? (
                  <CheckCircle className="w-4 h-4 text-[#10B981]" />
                ) : (
                  <div className="w-4 h-4 border-2 border-[#808080] rounded-full" />
                )}
                <span className={agentSigned ? 'text-[#10B981]' : 'text-[#808080]'}>
                  Agent {agentSigned ? 'Signed' : 'Not Signed'}
                </span>
              </div>
            </div>
          </div>

          {/* Privacy Notice */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-[#F59E0B] mb-1">Privacy Protection</h4>
                <p className="text-xs text-[#FAFAFA]/80">
                  Sensitive information (full address, seller name, contact details) is hidden until 
                  <strong> both parties</strong> sign this agreement. This protects all parties' privacy.
                </p>
              </div>
            </div>
          </div>

          {/* Agreement Terms */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 max-h-64 overflow-y-auto">
            <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">Agreement Terms</h4>
            <div className="text-sm text-[#808080] space-y-2">
              <p><strong className="text-[#FAFAFA]">1. Confidentiality:</strong> All deal information shared on this platform is confidential and shall not be disclosed to third parties.</p>
              <p><strong className="text-[#FAFAFA]">2. Cooperation:</strong> Both parties agree to cooperate in good faith to complete this transaction.</p>
              <p><strong className="text-[#FAFAFA]">3. Commission Terms:</strong> Agent compensation is as outlined in the deal terms section.</p>
              <p><strong className="text-[#FAFAFA]">4. Information Access:</strong> Upon signing by both parties, full property details including seller information will be disclosed.</p>
              <p><strong className="text-[#FAFAFA]">5. Platform Terms:</strong> Both parties agree to abide by Investor Konnect's Terms of Service.</p>
            </div>
          </div>

          {/* Already Signed Notice */}
          {currentUserSigned && (
            <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
              <CheckCircle className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
              <p className="text-sm font-semibold text-[#10B981]">You've Already Signed</p>
              <p className="text-xs text-[#808080] mt-1">
                {bothSigned 
                  ? 'Both parties have signed - full details are unlocked!'
                  : `Waiting for ${isInvestor ? 'agent' : 'investor'} to sign`
                }
              </p>
            </div>
          )}

          {/* Signing Actions */}
          {!currentUserSigned && (
            <>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="agree"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 rounded border-[#1F1F1F] bg-[#0D0D0D] text-[#E3C567]"
                />
                <label htmlFor="agree" className="text-sm text-[#FAFAFA] cursor-pointer">
                  I have read and agree to the terms of this Internal Operating Agreement
                </label>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={onClose}
                  variant="outline"
                  className="flex-1 border-[#1F1F1F] hover:bg-[#141414]"
                  disabled={signing}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSign}
                  disabled={!agreed || signing}
                  className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold"
                >
                  {signing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4 mr-2" />
                      Sign IOA
                    </>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}