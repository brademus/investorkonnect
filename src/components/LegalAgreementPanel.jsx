import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { FileText, CheckCircle2, Clock, Download, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function LegalAgreementPanel({ deal, profile, onUpdate = null, dealId = null }) {
  const [agreement, setAgreement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [exhibitA, setExhibitA] = useState(null);
  const [pendingOffer, setPendingOffer] = useState(null);
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [counterType, setCounterType] = useState('flat');
  const [counterAmount, setCounterAmount] = useState('');

  const effectiveDealId = deal?.id || dealId;
  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const isFullySigned = agreement?.investor_signed_at && agreement?.agent_signed_at;

  // Load agreement and pending offers
  useEffect(() => {
    if (!effectiveDealId) return;

    let mounted = true;

    (async () => {
      try {
        const [agreementRes, offersRes] = await Promise.all([
          base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId }).catch(() => ({ data: {} })),
          base44.entities.CounterOffer.filter({ deal_id: effectiveDealId, status: 'pending' }, '-created_date', 1).catch(() => [])
        ]);

        if (!mounted) return;

        if (agreementRes?.data?.agreement) {
          setAgreement(agreementRes.data.agreement);
        } else {
          setAgreement(null);
        }

        if (offersRes?.length > 0) {
          setPendingOffer(offersRes[0]);
        } else {
          setPendingOffer(null);
        }

        setLoading(false);
      } catch (e) {
        console.error('Error loading agreement:', e);
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [effectiveDealId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!effectiveDealId) return;

    const unsubscribe = base44.entities.CounterOffer.subscribe((event) => {
      if (event?.data?.deal_id !== effectiveDealId) return;

      if (event.type === 'create' && event.data?.status === 'pending') {
        setPendingOffer(event.data);
      } else if (event.type === 'update') {
        if (event.data?.status === 'accepted') {
          setPendingOffer(null);
        }
      }
    });

    return () => { try { unsubscribe?.(); } catch (_) {} };
  }, [effectiveDealId]);

  const handleOpenGenerateModal = async () => {
    if (!effectiveDealId) {
      toast.error('Deal ID missing');
      return;
    }

    try {
      const { data } = await base44.functions.invoke('getDealDetailsForUser', { dealId: effectiveDealId });
      const currentDeal = data?.deal || data || deal;

      if (!currentDeal) {
        toast.error('Failed to load deal data');
        return;
      }

      const terms = currentDeal.proposed_terms || {};
      setExhibitA({
        commission_type: terms.buyer_commission_type || 'flat',
        flat_fee_amount: terms.buyer_flat_fee || 0,
        commission_percentage: terms.buyer_commission_percentage || 0,
        net_target: terms.net_target || 0,
        transaction_type: terms.transaction_type || currentDeal.transaction_type || 'ASSIGNMENT',
        agreement_length_days: parseInt(terms.agreement_length, 10) || 180,
        termination_notice_days: 30,
      });
      setShowGenerateModal(true);
    } catch (error) {
      console.error('Error loading deal data:', error);
      toast.error('Failed to load deal data');
    }
  };

  const handleGenerate = async () => {
    if (!exhibitA || !effectiveDealId || !profile?.user_id) {
      toast.error('Missing required information');
      return;
    }

    setGenerating(true);

    try {
      let compensationModel = 'FLAT_FEE';
      if (exhibitA.commission_type === 'percentage') compensationModel = 'COMMISSION_PCT';
      else if (exhibitA.commission_type === 'net') compensationModel = 'NET_SPREAD';

      const response = await base44.functions.invoke('generateLegalAgreement', {
        deal_id: effectiveDealId,
        exhibit_a: {
          compensation_model: compensationModel,
          flat_fee_amount: exhibitA.flat_fee_amount || 0,
          commission_percentage: exhibitA.commission_percentage || 0,
          net_target: exhibitA.net_target || 0,
          transaction_type: exhibitA.transaction_type || 'ASSIGNMENT',
          agreement_length_days: exhibitA.agreement_length_days || 180,
          termination_notice_days: exhibitA.termination_notice_days || 30,
        },
        use_buyer_terms: true,
      });

      if (response.data?.error) {
        toast.error(response.data.error);
        return;
      }

      toast.success('Agreement generated successfully');

      // Reload agreement
      const agreementRes = await base44.functions.invoke('getLegalAgreement', { deal_id: effectiveDealId });
      if (agreementRes?.data?.agreement) {
        setAgreement(agreementRes.data.agreement);
      }

      setShowGenerateModal(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error(`Generate failed: ${error?.message || 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleSign = async (role) => {
    if (!agreement) {
      toast.error('No agreement to sign');
      return;
    }

    // Agent can't sign if there's a pending offer or terms mismatch
    if (role === 'agent') {
      if (pendingOffer?.status === 'pending') {
        toast.error('Counter offer pending. Wait for investor to respond.');
        return;
      }
      if (!agreement.investor_signed_at) {
        toast.error('Investor must sign first.');
        return;
      }
    }

    setSigning(true);

    try {
      const returnUrl = window.location.pathname + window.location.search;
      const response = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role,
        redirect_url: returnUrl,
      });

      if (!response?.data?.signing_url) {
        toast.error('Failed to get signing URL');
        setSigning(false);
        return;
      }

      window.location.assign(response.data.signing_url);
    } catch (error) {
      toast.error(`Signing failed: ${error?.message || 'Unknown error'}`);
      setSigning(false);
    }
  };

  const submitCounterOffer = async () => {
    if (!effectiveDealId || !counterAmount) {
      toast.error('Invalid counter offer');
      return;
    }

    try {
      // Mark existing pending offer as superseded
      if (pendingOffer) {
        await base44.entities.CounterOffer.update(pendingOffer.id, { status: 'superseded' });
      }

      const terms = counterType === 'flat'
        ? { buyer_commission_type: 'flat', buyer_flat_fee: Number(counterAmount), buyer_commission_percentage: null }
        : { buyer_commission_type: 'percentage', buyer_commission_percentage: Number(counterAmount), buyer_flat_fee: null };

      const newOffer = await base44.entities.CounterOffer.create({
        deal_id: effectiveDealId,
        from_role: isInvestor ? 'investor' : 'agent',
        terms,
        status: 'pending',
      });

      setPendingOffer(newOffer);
      setShowCounterModal(false);
      setCounterAmount('');
      toast.success('Counter offer sent');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to send counter offer');
    }
  };

  const acceptOffer = async () => {
    if (!pendingOffer || !effectiveDealId || !deal) return;

    try {
      const currentTerms = deal.proposed_terms || {};
      const newTerms = {
        ...currentTerms,
        buyer_commission_type: pendingOffer.terms?.buyer_commission_type,
        buyer_commission_percentage: pendingOffer.terms?.buyer_commission_percentage,
        buyer_flat_fee: pendingOffer.terms?.buyer_flat_fee,
      };

      await Promise.all([
        base44.entities.Deal.update(effectiveDealId, { proposed_terms: newTerms }),
        base44.entities.CounterOffer.update(pendingOffer.id, { status: 'accepted' })
      ]);

      setPendingOffer(null);
      toast.success('Counter offer accepted - investor must regenerate agreement');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to accept counter offer');
    }
  };

  const declineOffer = async () => {
    if (!pendingOffer || !effectiveDealId) return;

    try {
      await base44.entities.CounterOffer.update(pendingOffer.id, { status: 'declined' });
      await base44.functions.invoke('voidDeal', { deal_id: effectiveDealId });
      setPendingOffer(null);
      toast.success('Counter offer declined');
      if (onUpdate) onUpdate();
    } catch (error) {
      toast.error('Failed to decline counter offer');
    }
  };

  const getStatusBadge = () => {
    if (!agreement) return null;
    const statusConfig = {
      draft: { color: 'text-[#808080]', icon: FileText },
      sent: { color: 'text-blue-400', icon: Clock },
      investor_signed: { color: 'text-yellow-400', icon: CheckCircle2 },
      agent_signed: { color: 'text-yellow-400', icon: CheckCircle2 },
      fully_signed: { color: 'text-green-400', icon: CheckCircle2 },
    };
    const config = statusConfig[agreement.status] || statusConfig.draft;
    const Icon = config.icon;
    const label = getAgreementStatusLabel({ agreement, role: isAgent ? 'agent' : 'investor' })?.label || 'Sign Contract';

    return (
      <Badge variant="outline" className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-transparent border-[#1F1F1F]`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>{label}</span>
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card className="ik-card p-0 bg-[#0D0D0D] border-[#1F1F1F]">
        <CardHeader className="border-b border-[#1F1F1F]">
          <CardTitle className="text-[#FAFAFA]">Legal Agreement</CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-8 text-[#808080]">Loading agreement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="ik-card p-0 bg-[#0D0D0D] border-[#1F1F1F]">
      <CardHeader className="border-b border-[#1F1F1F] py-4">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-[#FAFAFA]">Legal Agreement</CardTitle>
            <p className="text-sm text-[#808080] mt-1">Internal Agreement v1.0.1</p>
          </div>
          {agreement && getStatusBadge()}
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* No agreement yet */}
        {!agreement ? (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
            <p className="text-[#808080] mb-4">No agreement generated yet</p>
            {isInvestor && (
              <Button onClick={handleOpenGenerateModal} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                Generate Agreement
              </Button>
            )}
            {isAgent && (
              <p className="text-xs text-[#808080] mt-2">Waiting for investor to generate agreement</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pending counter offer */}
            {pendingOffer?.status === 'pending' && (
              <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
                <div className="text-[#FAFAFA] font-semibold mb-3">Proposed New Deal Terms</div>
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-[#808080]">Type:</span>
                    <span className="text-[#FAFAFA] ml-2 capitalize">{pendingOffer.terms?.buyer_commission_type}</span>
                  </div>
                  <div>
                    <span className="text-[#808080]">Amount:</span>
                    <span className="text-[#FAFAFA] ml-2">
                      {pendingOffer.terms?.buyer_commission_type === 'percentage'
                        ? `${pendingOffer.terms?.buyer_commission_percentage}%`
                        : `$${(pendingOffer.terms?.buyer_flat_fee || 0).toLocaleString()}`}
                    </span>
                  </div>
                </div>

                {isInvestor && (
                  <div className="flex flex-col gap-2 mt-4">
                    <Button size="sm" className="bg-[#10B981] hover:bg-[#059669] text-white w-full" onClick={acceptOffer}>
                      Accept
                    </Button>
                    <Button size="sm" variant="destructive" className="w-full" onClick={declineOffer}>
                      Decline
                    </Button>
                    <Button
                      size="sm"
                      className="bg-[#E3C567] hover:bg-[#EDD89F] text-black w-full"
                      onClick={() => {
                        setCounterType(pendingOffer.terms?.buyer_commission_type || 'flat');
                        setCounterAmount(String(pendingOffer.terms?.buyer_commission_type === 'percentage'
                          ? pendingOffer.terms?.buyer_commission_percentage || 0
                          : pendingOffer.terms?.buyer_flat_fee || 0));
                        setShowCounterModal(true);
                      }}
                    >
                      Propose Counter Offer
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Agreement terms */}
            <div className="bg-[#0D0D0D] rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#808080]">State:</span>
                <span className="text-[#FAFAFA]">{agreement.governing_state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Transaction Type:</span>
                <span className="text-[#FAFAFA]">{agreement.transaction_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#808080]">Compensation:</span>
                <span className="text-[#FAFAFA]">{agreement.exhibit_a_terms?.compensation_model}</span>
              </div>
            </div>

            {/* Signature status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                <div className="text-xs text-[#808080] mb-2">Investor</div>
                {agreement.investor_signed_at ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Signed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#808080]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending</span>
                  </div>
                )}
              </div>
              <div className="bg-[#0D0D0D] rounded-xl p-4">
                <div className="text-xs text-[#808080] mb-2">Agent</div>
                {agreement.agent_signed_at ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-sm">Signed</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[#808080]">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm">Pending</span>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-3">
              {/* Investor signing */}
              {!agreement.investor_signed_at && isInvestor && (
                <Button onClick={() => handleSign('investor')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  {signing ? 'Opening DocuSign...' : 'Sign as Investor'}
                </Button>
              )}

              {/* Investor regenerate (only when agreed and not fully signed) */}
              {isInvestor && !isFullySigned && agreement && (
                <Button onClick={handleOpenGenerateModal} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  Regenerate Agreement
                </Button>
              )}

              {/* Agent signing */}
              {agreement.investor_signed_at && !agreement.agent_signed_at && isAgent && (
                <>
                  {pendingOffer?.status === 'pending' && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA] font-semibold">Counter Offer Pending</p>
                      <p className="text-xs text-[#808080] mt-1">Cannot sign until investor responds</p>
                    </div>
                  )}
                  {!pendingOffer?.status && (
                    <Button onClick={() => handleSign('agent')} disabled={signing} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                      {signing ? 'Opening DocuSign...' : 'Sign as Agent'}
                    </Button>
                  )}
                </>
              )}

              {/* Fully signed */}
              {isFullySigned && (
                <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                  <CheckCircle2 className="w-8 h-8 text-[#10B981] mx-auto mb-2" />
                  <p className="text-[#FAFAFA] font-semibold">Fully Signed</p>
                  <p className="text-xs text-[#808080] mt-1">Agreement complete</p>
                </div>
              )}

              {/* Download PDF */}
              {(agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url) && (
                <Button
                  onClick={() => window.open(agreement.signed_pdf_url || agreement.final_pdf_url || agreement.pdf_file_url, '_blank')}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                >
                  <Download className="w-4 h-4 mr-2" />
                  {agreement.signed_pdf_url ? 'Download Signed PDF' : 'View Agreement PDF'}
                </Button>
              )}

              {/* Counter offer button */}
              {!isFullySigned && isAgent && agreement && (
                <Button
                  onClick={() => {
                    const t = deal?.proposed_terms || {};
                    setCounterType(t.buyer_commission_type || 'flat');
                    setCounterAmount(String(t.buyer_commission_type === 'percentage' ? (t.buyer_commission_percentage || 0) : (t.buyer_flat_fee || 0)));
                    setShowCounterModal(true);
                  }}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                >
                  Propose Counter Offer
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* Generate Modal */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Generate Agreement</DialogTitle>
          </DialogHeader>

          {!exhibitA ? (
            <div className="py-8 text-center text-[#808080]">Loading terms...</div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-[#FAFAFA]">Compensation Type</Label>
                <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA] mt-1">
                  {exhibitA.commission_type === 'percentage' ? 'Percentage' : exhibitA.commission_type === 'flat' ? 'Flat Fee' : 'Net'}
                </div>
              </div>

              {exhibitA.commission_type === 'flat' && (
                <div>
                  <Label className="text-[#FAFAFA]">Flat Fee</Label>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA] mt-1">
                    ${(exhibitA.flat_fee_amount || 0).toLocaleString()}
                  </div>
                </div>
              )}

              {exhibitA.commission_type === 'percentage' && (
                <div>
                  <Label className="text-[#FAFAFA]">Commission %</Label>
                  <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl px-4 py-3 text-[#FAFAFA] mt-1">
                    {exhibitA.commission_percentage}%
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowGenerateModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleGenerate} disabled={generating} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                  {generating ? 'Generating...' : 'Generate'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Counter Offer Modal */}
      <Dialog open={showCounterModal} onOpenChange={setShowCounterModal}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <DialogHeader>
            <DialogTitle className="text-[#FAFAFA]">Propose Counter Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-[#FAFAFA]">Type</Label>
              <Select value={counterType} onValueChange={setCounterType}>
                <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[#141414] border-[#1F1F1F]">
                  <SelectItem value="flat" className="text-[#FAFAFA]">Flat Fee</SelectItem>
                  <SelectItem value="percentage" className="text-[#FAFAFA]">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[#FAFAFA]">Amount</Label>
              <Input
                type="number"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                placeholder={counterType === 'percentage' ? 'Enter %' : 'Enter $'}
                className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA] mt-1"
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowCounterModal(false)} className="flex-1">Cancel</Button>
              <Button onClick={submitCounterOffer} className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black">Submit</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}