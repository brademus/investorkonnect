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
  const { profile, loading: profileLoading } = useCurrentProfile();

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

  // Load deal and room data - wait for profile first
  useEffect(() => {
    const loadData = async () => {
      // Wait for profile to load
      if (profileLoading || !profile) {
        return;
      }

      try {
        let loadedDeal = null;
        let loadedRoom = null;
        
        if (dealId) {
          const d = await base44.entities.Deal.filter({ id: dealId });
          loadedDeal = d[0] || null;
          setDeal(loadedDeal);
        }
        if (roomId) {
          const r = await base44.entities.Room.filter({ id: roomId });
          loadedRoom = r[0] || null;
          setRoom(loadedRoom);
          if (loadedRoom?.current_legal_agreement_id) {
            const a = await base44.entities.LegalAgreement.filter({ 
              id: loadedRoom.current_legal_agreement_id 
            });
            setAgreement(a[0] || null);
          }
        }
        
        // Pre-fill commission from current terms (agent-specific > room > deal > agreement)
        if (!respondingTo) {
          const agentId = isAgent ? profile?.id : null;
          const agentTerms = agentId && loadedRoom?.agent_terms?.[agentId];
          const terms = agentTerms?.buyer_commission_type ? agentTerms 
            : (loadedRoom?.proposed_terms?.buyer_commission_type ? loadedRoom.proposed_terms 
            : loadedDeal?.proposed_terms);
          if (terms?.buyer_commission_type) {
            const normalizedType = terms.buyer_commission_type === 'percentage' ? 'percentage' : 'flat_fee';
            setCommissionType(normalizedType);
            if (terms.buyer_commission_type === 'percentage' && terms.buyer_commission_percentage) {
              setCommissionAmount(String(terms.buyer_commission_percentage));
            } else if (terms.buyer_flat_fee) {
              setCommissionAmount(String(terms.buyer_flat_fee));
            }
          }
        }
        
        if (respondingTo) {
          const c = await base44.entities.CounterOffer.filter({ id: respondingTo });
          if (c[0]) {
            setCounterToRespond(c[0]);
            // Pre-fill form with inverse terms
            if (c[0].terms_delta?.buyer_commission_type) {
              // Normalize: flat_fee -> flat, percentage -> percentage
              const normalizedType = c[0].terms_delta.buyer_commission_type === 'percentage' ? 'percentage' : 'flat_fee';
              setCommissionType(normalizedType);
              if (c[0].terms_delta.buyer_commission_type === 'percentage') {
                setCommissionAmount(String(c[0].terms_delta.buyer_commission_percentage || ''));
              } else {
                setCommissionAmount(String(c[0].terms_delta.buyer_flat_fee || ''));
              }
            }
          }
        }
        setLoading(false);
      } catch (e) {
        console.error('[CounterOffer] Load error:', e);
        setError('Failed to load deal');
        setLoading(false);
      }
    };
    loadData();
  }, [dealId, roomId, respondingTo, profile, profileLoading]);

  const handleSendCounter = async () => {
    if (!profile?.user_role) {
      toast.error('Profile not loaded. Please refresh.');
      return;
    }

    if (!commissionAmount) {
      toast.error('Please enter commission amount');
      return;
    }

    setBusy(true);
    try {
      // CRITICAL: Normalize commission type to match what agreement generation expects
      // generateLegalAgreement checks for 'percentage' or 'flat' in exhibit_a
      const normalizedType = commissionType === 'percentage' ? 'percentage' : 'flat';
      const counterTerms = {
        buyer_commission_type: normalizedType,
        buyer_commission_percentage: normalizedType === 'percentage' ? parseFloat(commissionAmount) : null,
        buyer_flat_fee: normalizedType !== 'percentage' ? parseFloat(commissionAmount) : null,
      };

      if (isResponding && respondingTo) {
        // Responding to an existing counter - decline the old one and send a new counter
        // First decline the existing counter
        await base44.functions.invoke('respondToCounterOffer', {
          counter_offer_id: respondingTo,
          action: 'decline',
        });

        // Then send a new counter offer with the new terms
        if (!roomId) {
          toast.error('Room ID required to send counter offer');
          setBusy(false);
          return;
        }

        const res = await base44.functions.invoke('sendCounterOffer', {
          deal_id: dealId,
          room_id: roomId,
          new_terms: counterTerms,
        });

        if (res.data?.error) {
          toast.error(res.data.error);
        } else if (res.data?.ok || res.data?.success) {
          toast.success('Counter offer sent');
          setTimeout(() => navigate(-1), 500);
        } else {
          toast.error('Failed to send counter');
        }
      } else {
         // Creating new counter - must have room_id to scope to specific agent
         if (!roomId) {
           toast.error('Room ID required to send counter offer');
           setBusy(false);
           return;
         }

         const res = await base44.functions.invoke('sendCounterOffer', {
           deal_id: dealId,
           room_id: roomId,
           new_terms: counterTerms,
         });

         if (res.data?.error) {
           toast.error(res.data.error);
         } else if (res.data?.ok || res.data?.success) {
           toast.success('Counter offer sent');
           setTimeout(() => navigate(-1), 500);
         } else {
           toast.error('Failed to send counter');
         }
      }
    } catch (e) {
      console.error('[CounterOffer] Send error:', e);
      toast.error(e?.response?.data?.error || 'Failed to send counter');
    } finally {
      setBusy(false);
    }
  };

  if (profileLoading || loading) {
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
          {/* Current Terms Display - resolve from best source */}
          {(() => {
            const agentId = isAgent ? profile?.id : null;
            const agentTerms = agentId && room?.agent_terms?.[agentId];
            const terms = agentTerms?.buyer_commission_type ? agentTerms 
              : (room?.proposed_terms?.buyer_commission_type ? room.proposed_terms 
              : deal?.proposed_terms);
            if (!terms?.buyer_commission_type) return null;
            const commDisplay = terms.buyer_commission_type === 'percentage'
              ? `${terms.buyer_commission_percentage ?? 0}%`
              : `$${(terms.buyer_flat_fee ?? 0).toLocaleString()}`;
            return (
              <div className="bg-[#141414] rounded-lg p-4 text-sm space-y-2">
                <p className="text-[#808080]">Current Buyer Commission</p>
                <p className="text-[#FAFAFA] font-semibold">{commDisplay}</p>
              </div>
            );
          })()}

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
            className="flex-1 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#E3C567]/40 hover:border-[#E3C567]"
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