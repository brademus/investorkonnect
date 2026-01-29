import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * COUNTER OFFER NEGOTIATION PAGE
 * - Agent/Investor sends counter offer with commission changes
 * - Recipient can accept or deny
 * - If accepted: investor must regenerate & sign, then agent signs
 * - If denied: sending party is voided from deal
 */
export default function CounterOfferPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile } = useCurrentProfile();

  const dealId = searchParams.get('dealId');
  const roomId = searchParams.get('roomId');
  const respondingTo = searchParams.get('respondingTo'); // Counter offer ID if responding

  const [deal, setDeal] = useState(null);
  const [room, setRoom] = useState(null);
  const [agreement, setAgreement] = useState(null);
  const [counterToRespond, setCounterToRespond] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  
  const [commissionType, setCommissionType] = useState('percentage');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [error, setError] = useState(null);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const isResponding = !!respondingTo;

  // Load deal and room data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (dealId) {
          const d = await base44.entities.Deal.filter({ id: dealId });
          setDeal(d[0] || null);
        }
        if (roomId) {
          const r = await base44.entities.Room.filter({ id: roomId });
          setRoom(r[0] || null);
          if (r[0]?.current_legal_agreement_id) {
            const a = await base44.entities.LegalAgreement.filter({ 
              id: r[0].current_legal_agreement_id 
            });
            setAgreement(a[0] || null);
          }
        }
        if (respondingTo) {
          const c = await base44.entities.CounterOffer.filter({ id: respondingTo });
          if (c[0]) {
            setCounterToRespond(c[0]);
            // Pre-fill form with inverse terms
            if (c[0].terms_delta?.buyer_commission_type) {
              setCommissionType(c[0].terms_delta.buyer_commission_type);
              if (c[0].terms_delta.buyer_commission_type === 'percentage') {
                setCommissionAmount(String(c[0].terms_delta.buyer_commission_percentage || ''));
              } else {
                setCommissionAmount(String(c[0].terms_delta.buyer_flat_fee || ''));
              }
            }
          }
        }
      } catch (e) {
        console.error('[CounterOffer] Load error:', e);
        setError('Failed to load deal');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [dealId, roomId, respondingTo]);

  const handleSendCounter = async () => {
    if (!commissionAmount) {
      toast.error('Please enter commission amount');
      return;
    }

    setBusy(true);
    try {
      const counterTerms = {
        buyer_commission_type: commissionType,
        buyer_commission_percentage: commissionType === 'percentage' ? parseFloat(commissionAmount) : null,
        buyer_flat_fee: commissionType === 'flat_fee' ? parseFloat(commissionAmount) : null,
      };

      if (isResponding && respondingTo) {
        // Responding to an existing counter - use recounter action
        const res = await base44.functions.invoke('respondToCounterOffer', {
          counter_offer_id: respondingTo,
          action: 'recounter',
          terms_delta: counterTerms,
        });

        if (res.data?.error) {
          toast.error(res.data.error);
        } else {
          toast.success('Counter offer sent');
          setTimeout(() => navigate(-1), 500);
        }
      } else {
        // Creating new counter - must have room_id to scope to specific agent
        if (!roomId) {
          toast.error('Room ID required to send counter offer');
          setBusy(false);
          return;
        }
        
        const res = await base44.functions.invoke('createCounterOffer', {
          deal_id: dealId,
          room_id: roomId,
          from_role: isAgent ? 'agent' : 'investor',
          to_role: isAgent ? 'investor' : 'agent',
          terms_delta: counterTerms,
        });

        if (res.data?.error) {
          toast.error(res.data.error);
        } else {
          toast.success('Counter offer sent');
          setTimeout(() => navigate(-1), 500);
        }
      }
    } catch (e) {
      console.error('[CounterOffer] Send error:', e);
      toast.error(e?.response?.data?.error || 'Failed to send counter');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Dialog open={true}>
        <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F]">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#E3C567]" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={true} onOpenChange={() => navigate(-1)}>
      <DialogContent className="bg-[#0D0D0D] border-[#1F1F1F] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[#FAFAFA]">
            {isResponding 
              ? (isAgent ? 'Counter Back to Investor' : 'Counter Back to Agent')
              : (isAgent ? 'Counter Offer' : 'Counter Offer to Agent')
            }
          </DialogTitle>
        </DialogHeader>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
            {error}
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* Current Terms Display */}
          {deal?.proposed_terms && (
            <div className="bg-[#141414] rounded-lg p-4 text-sm space-y-2">
              <p className="text-[#808080]">Current Buyer Commission</p>
              <p className="text-[#FAFAFA] font-semibold">
                {deal.proposed_terms.buyer_commission_type === 'percentage'
                  ? `${deal.proposed_terms.buyer_commission_percentage}%`
                  : `$${deal.proposed_terms.buyer_flat_fee?.toLocaleString()}`}
              </p>
            </div>
          )}

          {/* Commission Type Selector */}
          <div>
            <label className="text-xs text-[#808080] mb-2 block">Commission Type</label>
            <Select value={commissionType} onValueChange={setCommissionType}>
              <SelectTrigger className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#141414] border-[#1F1F1F]">
                <SelectItem value="percentage">Percentage</SelectItem>
                <SelectItem value="flat_fee">Flat Fee</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Amount Input */}
          <div>
            <label className="text-xs text-[#808080] mb-2 block">
              {commissionType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
            </label>
            <Input
              type="number"
              value={commissionAmount}
              onChange={(e) => setCommissionAmount(e.target.value)}
              placeholder={commissionType === 'percentage' ? '3.5' : '50000'}
              className="bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
            />
          </div>

          {/* Info Message */}
          <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-lg p-3 text-xs text-[#FAFAFA] flex gap-2">
            <AlertTriangle className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
            <div>
              {isAgent
                ? 'The investor will review your counter offer. If they accept, they\'ll regenerate the agreement with these terms.'
                : 'The agent will review your counter offer. If they accept, you\'ll need to regenerate the agreement with these terms.'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1 border-[#1F1F1F] text-[#FAFAFA]"
            onClick={() => navigate(-1)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black"
            onClick={handleSendCounter}
            disabled={busy}
          >
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Send Counter
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}