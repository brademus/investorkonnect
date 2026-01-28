import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Download, Loader2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

/**
 * SIMPLIFIED AGREEMENT PANEL
 * - Generate agreement (investor only)
 * - Sign agreement
 * - Show status badges
 * - Auto-hide from other agents once one signs
 */
export default function SimpleAgreementPanel({ dealId, agreement, profile }) {
  const [busy, setBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  
  const investorSigned = !!agreement?.investor_signed_at;
  const agentSigned = !!agreement?.agent_signed_at;
  const fullySigned = investorSigned && agentSigned;
  
  // Can regenerate ONLY if counter accepted or deal terms changed (flag in deal)
  const canRegenerate = agreement && agreement.status !== 'fully_signed' && 
                        (agreement.requires_regenerate === true);

  // Show form only to investor, only if no agreement yet or regenerate needed
  const showGenerateForm = isInvestor && (!agreement || agreement.status === 'draft' || agreement.status === 'superseded');

  // Handle generate agreement
  const handleGenerate = async () => {
    setBusy(true);
    toast.loading('Generating...', { id: 'gen' });

    try {
      const res = await base44.functions.invoke('regenerateActiveAgreement', {
        deal_id: dealId,
        room_id: null
      });

      toast.dismiss('gen');

      if (res.data?.error) {
        toast.error(res.data.error);
      } else {
        toast.success('Agreement ready');
      }
    } catch (e) {
      toast.dismiss('gen');
      toast.error('Generation failed');
    } finally {
      setBusy(false);
    }
  };

  // Handle sign
  const handleSign = async (role) => {
    setBusy(true);

    try {
      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role,
        redirect_url: window.location.href
      });

      if (res.data?.already_signed) {
        toast.success('Already signed');
        setBusy(false);
        return;
      }

      if (res.data?.signing_url) {
        window.location.assign(res.data.signing_url);
      } else {
        toast.error('Failed to start signing');
        setBusy(false);
      }
    } catch (e) {
      toast.error('Signing failed');
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
        <CardHeader className="border-b border-[#1F1F1F]">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg text-[#FAFAFA]">Agreement & Terms</CardTitle>
            {agreement && (
              <Badge className="bg-transparent border-[#1F1F1F]">
                {fullySigned ? (
                  <span className="text-green-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Signed
                  </span>
                ) : investorSigned ? (
                  <span className="text-yellow-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Awaiting Agent
                  </span>
                ) : (
                  <span className="text-blue-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Pending
                  </span>
                )}
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          {/* No Agreement Yet */}
          {!agreement && (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
              <p className="text-[#808080] mb-4">No agreement yet</p>
              {isInvestor && (
                <Button
                  onClick={handleGenerate}
                  disabled={busy}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                >
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Generate Agreement
                </Button>
              )}
            </div>
          )}

          {/* Agreement Exists */}
          {agreement && (
            <div className="space-y-4">
              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#141414] rounded-xl p-4">
                  <p className="text-xs text-[#808080] mb-1">Investor</p>
                  {investorSigned ? (
                    <p className="text-green-400 text-sm font-semibold">✓ Signed</p>
                  ) : (
                    <p className="text-[#808080] text-sm">Pending</p>
                  )}
                </div>
                <div className="bg-[#141414] rounded-xl p-4">
                  <p className="text-xs text-[#808080] mb-1">Agent</p>
                  {agentSigned ? (
                    <p className="text-green-400 text-sm font-semibold">✓ Signed</p>
                  ) : (
                    <p className="text-[#808080] text-sm">Pending</p>
                  )}
                </div>
              </div>

              {/* Investor Actions */}
              {isInvestor && !fullySigned && (
                <div className="space-y-2">
                  {!investorSigned && !canRegenerate && (
                    <Button
                      onClick={() => handleSign('investor')}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                    >
                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Sign Agreement
                    </Button>
                  )}

                  {canRegenerate && (
                    <Button
                      onClick={() => setConfirmModal(true)}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                    >
                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Regenerate & Sign
                    </Button>
                  )}

                  {investorSigned && !agentSigned && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for agent to sign</p>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Actions */}
              {isAgent && !fullySigned && (
                <div>
                  {!investorSigned && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to sign first</p>
                    </div>
                  )}

                  {investorSigned && !agentSigned && (
                    <Button
                      onClick={() => handleSign('agent')}
                      disabled={busy}
                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                    >
                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Sign as Agent
                    </Button>
                  )}
                </div>
              )}

              {/* Fully Signed Success */}
              {fullySigned && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
                  <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
                </div>
              )}

              {/* Download PDF */}
              {agreement?.signed_pdf_url && (
                <Button
                  onClick={() => window.open(agreement.signed_pdf_url, '_blank')}
                  variant="outline"
                  className="w-full"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regenerate Confirm Modal */}
      <Dialog open={confirmModal} onOpenChange={setConfirmModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Regenerate Agreement</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 text-xs text-[#FAFAFA] flex gap-2">
              <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div>The agreement will be regenerated with new terms and you'll need to sign again.</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmModal(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black"
              onClick={() => {
                setConfirmModal(false);
                handleGenerate();
              }}
              disabled={busy}
            >
              {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Regenerate
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}