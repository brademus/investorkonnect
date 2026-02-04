import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AGREEMENT PANEL for Room Page
 * Shows agreement status and signing for agents
 * Handles counter offers
 */
export default function AgreementPanel({ dealId, roomId, profile, initialAgreement }) {
  const [agreement, setAgreement] = useState(initialAgreement || null);
  const [room, setRoom] = useState(null);
  const [pendingCounters, setPendingCounters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(!initialAgreement);
  const agreementInitializedRef = useRef(false);

  const isAgent = profile?.user_role === 'agent';

  // Update agreement when initialAgreement changes (from parent)
  useEffect(() => {
    if (initialAgreement) {
      setAgreement(initialAgreement);
      agreementInitializedRef.current = true;
      console.log('[AgreementPanel] Updated from initialAgreement');
    }
  }, [initialAgreement?.id]); // Only trigger on ID change to avoid loops

  // Load room and agreement
  useEffect(() => {
    if (!dealId || !roomId || agreementInitializedRef.current) return;

    (async () => {
      try {
        // Load room
        const rooms = await base44.entities.Room.filter({ id: roomId });
        if (rooms[0]) setRoom(rooms[0]);

        // Skip if we already have a valid agreement from props
        if (agreement?.id) {
          console.log('[AgreementPanel] Already have agreement, skipping load');
          setLoading(false);
          return;
        }

        // Try multiple strategies to find agreement
        let foundAgreement = null;

        // Strategy 1: Both deal_id and room_id
        let agreements = await base44.entities.LegalAgreement.filter({ 
          deal_id: dealId,
          room_id: roomId 
        });
        if (agreements[0]) {
          foundAgreement = agreements[0];
          console.log('[AgreementPanel] Found by deal_id + room_id');
        }

        // Strategy 2: Just deal_id
        if (!foundAgreement) {
          const dealAgreements = await base44.entities.LegalAgreement.filter({ 
            deal_id: dealId 
          });
          if (dealAgreements[0]) {
            foundAgreement = dealAgreements[0];
            console.log('[AgreementPanel] Found by deal_id');
          }
        }

        // Strategy 3: Just room_id
        if (!foundAgreement) {
          const roomAgreements = await base44.entities.LegalAgreement.filter({ 
            room_id: roomId 
          });
          if (roomAgreements[0]) {
            foundAgreement = roomAgreements[0];
            console.log('[AgreementPanel] Found by room_id');
          }
        }

        if (foundAgreement) {
          setAgreement(foundAgreement);
          agreementInitializedRef.current = true;
        } else {
          console.warn('[AgreementPanel] No agreement found for deal:', dealId, 'room:', roomId);
        }

        // Load pending counters - try multiple strategies
        let counters = [];
        
        // Strategy 1: Filter by room_id + status
        try {
          counters = await base44.entities.CounterOffer.filter({
            room_id: roomId,
            status: 'pending'
          });
          console.log('[AgreementPanel] Room+status filter returned:', counters.length);
        } catch (e) {
          console.warn('[AgreementPanel] Room+status filter failed:', e.message);
        }
        
        // Strategy 2: Filter by room_id only
        if (counters.length === 0) {
          try {
            const roomCounters = await base44.entities.CounterOffer.filter({
              room_id: roomId
            });
            counters = roomCounters.filter(c => c.status === 'pending');
            console.log('[AgreementPanel] Room filter returned:', roomCounters.length, 'pending:', counters.length);
          } catch (e) {
            console.warn('[AgreementPanel] Room filter failed:', e.message);
          }
        }
        
        // Strategy 3: Filter by deal_id + status
        if (counters.length === 0) {
          try {
            const dealCounters = await base44.entities.CounterOffer.filter({
              deal_id: dealId,
              status: 'pending'
            });
            counters = dealCounters;
            console.log('[AgreementPanel] Deal+status filter returned:', counters.length);
          } catch (e) {
            console.warn('[AgreementPanel] Deal+status filter failed:', e.message);
          }
        }
        
        // Strategy 4: Filter by deal_id only
        if (counters.length === 0) {
          try {
            const dealCounters = await base44.entities.CounterOffer.filter({
              deal_id: dealId
            });
            counters = dealCounters.filter(c => c.status === 'pending');
            console.log('[AgreementPanel] Deal filter returned:', dealCounters.length, 'pending:', counters.length);
          } catch (e) {
            console.warn('[AgreementPanel] Deal filter failed:', e.message);
          }
        }
        
        console.log('[AgreementPanel] Final counters:', counters.length, counters);
        setPendingCounters(counters);
      } catch (e) {
        console.error('[AgreementPanel] Load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, roomId]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!roomId) return;

    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event?.data?.room_id === roomId || event?.data?.deal_id === dealId) {
        setAgreement(prev => ({ ...prev, ...event.data }));
      }
    });

    const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
      if (event?.data?.room_id === roomId) {
        if (event.type === 'create') {
          setPendingCounters(prev => [...prev, event.data]);
        } else if (event.type === 'update' && event.data.status !== 'pending') {
          setPendingCounters(prev => prev.filter(c => c.id !== event.data.id));
        }
      }
    });

    return () => {
      try { unsubAgreement(); } catch (_) {}
      try { unsubCounter(); } catch (_) {}
    };
  }, [roomId, dealId]);

  const handleSign = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role: 'agent',
        room_id: roomId,
        redirect_url: window.location.href + '&signed=1'
      });

      if (res.data?.signing_url) {
        window.location.assign(res.data.signing_url);
      } else {
        toast.error('Failed to start signing');
        setBusy(false);
      }
    } catch (e) {
      console.error('[AgreementPanel] Sign error:', e);
      toast.error('Failed to start signing');
      setBusy(false);
    }
  };

  const handleAcceptCounter = async (counterId) => {
    try {
      const res = await base44.functions.invoke('acceptCounterOffer', {
        counter_id: counterId
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        return;
      }

      toast.success('Counter accepted - new agreement generated');
      setPendingCounters(prev => prev.filter(c => c.id !== counterId));

      // Reload agreement
      const agreements = await base44.entities.LegalAgreement.filter({ 
        deal_id: dealId,
        room_id: roomId 
      });
      if (agreements[0]) setAgreement(agreements[0]);
    } catch (e) {
      console.error('[AgreementPanel] Accept error:', e);
      toast.error('Failed to accept counter');
    }
  };

  const investorSigned = !!agreement?.investor_signed_at;
  const agentSigned = !!agreement?.agent_signed_at;
  const fullySigned = investorSigned && agentSigned;

  return (
    <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
      <CardHeader className="border-b border-[#1F1F1F]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#FAFAFA]">Agreement</CardTitle>
          {agreement && (
            <Badge className="bg-transparent border-[#1F1F1F]">
              {fullySigned ? (
                <span className="text-green-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Signed
                </span>
              ) : investorSigned ? (
                <span className="text-yellow-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              ) : (
                <span className="text-blue-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> Draft
                </span>
              )}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-4">
        {!agreement && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-[#808080] mx-auto mb-4 opacity-50" />
            <p className="text-[#808080]">No agreement yet</p>
          </div>
        )}

        {agreement && (
          <>
            {/* Status Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141414] rounded-xl p-4">
                <p className="text-xs text-[#808080] mb-1">Investor</p>
                <p className={investorSigned ? "text-green-400 text-sm font-semibold" : "text-[#808080] text-sm"}>
                  {investorSigned ? '✓ Signed' : 'Pending'}
                </p>
              </div>
              <div className="bg-[#141414] rounded-xl p-4">
                <p className="text-xs text-[#808080] mb-1">Agent</p>
                <p className={agentSigned ? "text-green-400 text-sm font-semibold" : "text-[#808080] text-sm"}>
                  {agentSigned ? '✓ Signed' : 'Pending'}
                </p>
              </div>
            </div>

            {/* Agent Actions */}
            {isAgent && !agentSigned && investorSigned && (
              <div className="space-y-2">
                <Button
                  onClick={handleSign}
                  disabled={busy}
                  className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                >
                  {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Sign Agreement
                </Button>
                <Button
                  onClick={() => window.location.href = `/SendCounter?dealId=${dealId}&roomId=${roomId}`}
                  variant="outline"
                  className="w-full border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414]"
                >
                  Make Counter Offer
                </Button>
              </div>
            )}
          </>
        )}

        {/* Pending Counters - Show for both investors and agents */}
        {pendingCounters.map(counter => {
          const isForMe = (isAgent && counter.to_role === 'agent') || (!isAgent && counter.to_role === 'investor');
          
          return (
            <div key={counter.id} className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-xl p-4">
              <p className="text-xs text-[#E3C567] mb-3 font-semibold">
                {counter.from_role === 'investor' ? 'Investor' : 'Agent'} Counter Offer
              </p>
              <div className="text-sm text-[#FAFAFA] mb-3">
                <p>Buyer Commission: {counter.terms_delta.buyer_commission_type === 'percentage'
                  ? `${counter.terms_delta.buyer_commission_percentage}%`
                  : `$${counter.terms_delta.buyer_flat_fee?.toLocaleString()}`}</p>
              </div>
              {isForMe && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAcceptCounter(counter.id)}
                    className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => window.location.href = `/SendCounter?dealId=${dealId}&roomId=${roomId}&respondingTo=${counter.id}`}
                    variant="outline"
                    className="flex-1 border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10 text-xs"
                  >
                    Counter Back
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        {/* Fully Signed */}
        {agreement && fullySigned && (
          <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
            <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
            <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}