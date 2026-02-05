import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

/**
 * AGREEMENT PANEL for Room Page
 * Shows agreement status and signing for both investors and agents
 * Handles counter offers and regeneration after terms change
 * 
 * CRITICAL: Each agent has their OWN agreement. When investor selects an agent,
 * we show ONLY that agent's agreement and counter offers.
 */
export default function AgreementPanel({ dealId, roomId, profile, initialAgreement, onAgreementChange, selectedAgentId }) {
  const [agreement, setAgreement] = useState(initialAgreement || null);
  const [room, setRoom] = useState(null);
  const [pendingCounters, setPendingCounters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(!initialAgreement);
  const agreementInitializedRef = useRef(false);

  const isAgent = profile?.user_role === 'agent';
  const isInvestor = profile?.user_role === 'investor';

  // Update agreement when initialAgreement changes (from parent)
  useEffect(() => {
    if (initialAgreement) {
      setAgreement(initialAgreement);
      agreementInitializedRef.current = true;
      console.log('[AgreementPanel] Updated from initialAgreement');
    }
  }, [initialAgreement?.id]); // Only trigger on ID change to avoid loops

  // Load room and agreement
  // CRITICAL: When selectedAgentId is provided, we need to find the RIGHT room for that agent
  useEffect(() => {
    if (!dealId || !roomId) return;
    
    // Reset initialized ref when roomId changes to allow reloading for different agents
    if (selectedAgentId) {
      agreementInitializedRef.current = false;
    }

    (async () => {
      try {
        // Load room - use the specific roomId passed in (should be agent-specific)
        const rooms = await base44.entities.Room.filter({ id: roomId });
        if (rooms[0]) setRoom(rooms[0]);
        
        console.log('[AgreementPanel] Loading for dealId:', dealId, 'roomId:', roomId, 'selectedAgentId:', selectedAgentId);

        // Skip if we already have a valid agreement from props that matches this room
        if (agreement?.id && agreement?.room_id === roomId) {
          console.log('[AgreementPanel] Already have agreement for this room, skipping load');
          setLoading(false);
          return;
        }

        // Try multiple strategies to find agreement - ALWAYS prioritize room-specific
        let foundAgreement = null;

        // Strategy 1: Both deal_id and room_id (MOST SPECIFIC - agent-specific agreement)
        let agreements = await base44.entities.LegalAgreement.filter({ 
          deal_id: dealId,
          room_id: roomId 
        });
        // Find the best non-voided agreement
        const draftAg = agreements.find(a => a.status === 'draft');
        const sentAg = agreements.find(a => a.status === 'sent');
        const nonVoidedAg = agreements.find(a => a.status !== 'voided');
        foundAgreement = draftAg || sentAg || nonVoidedAg || agreements[0];
        
        if (foundAgreement) {
          console.log('[AgreementPanel] Found by deal_id + room_id:', foundAgreement.id);
        }

        // Strategy 2: Just deal_id - ONLY if no room-specific agreement found
        // This is the base agreement before agent-specific negotiation
        if (!foundAgreement) {
          const dealAgreements = await base44.entities.LegalAgreement.filter({ 
            deal_id: dealId 
          });
          // Prefer agreements without room_id (base agreement)
          const baseAgreement = dealAgreements.find(a => !a.room_id && a.status !== 'voided');
          if (baseAgreement) {
            foundAgreement = baseAgreement;
            console.log('[AgreementPanel] Found base agreement by deal_id');
          }
        }

        if (foundAgreement) {
          setAgreement(foundAgreement);
          agreementInitializedRef.current = true;
        } else {
          console.warn('[AgreementPanel] No agreement found for deal:', dealId, 'room:', roomId);
        }

        // Load pending counters - STRICTLY for this room only
        let counters = [];
        
        // ONLY filter by room_id to get agent-specific counters
        try {
          counters = await base44.entities.CounterOffer.filter({
            room_id: roomId,
            status: 'pending'
          });
          console.log('[AgreementPanel] Room+status filter returned:', counters.length);
        } catch (e) {
          console.warn('[AgreementPanel] Room+status filter failed:', e.message);
        }
        
        // Fallback: Filter by room_id only, then filter pending
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
        
        // DO NOT fall back to deal_id only - that would show counters for ALL agents
        
        console.log('[AgreementPanel] Final counters for room', roomId, ':', counters.length, counters);
        setPendingCounters(counters);
      } catch (e) {
        console.error('[AgreementPanel] Load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [dealId, roomId, selectedAgentId]);

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
    setBusy(true);
    try {
      const res = await base44.functions.invoke('acceptCounterOffer', {
        counter_id: counterId
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        setBusy(false);
        return;
      }

      toast.success('Counter accepted - new agreement generated. Please sign the updated agreement.');
      setPendingCounters(prev => prev.filter(c => c.id !== counterId));

      // Use the agreement returned directly from the API (has latest terms)
      if (res.data?.agreement) {
        console.log('[AgreementPanel] Using agreement from response:', res.data.agreement.id);
        setAgreement(res.data.agreement);
        if (onAgreementChange) onAgreementChange(res.data.agreement);
      } else {
        // Fallback: Reload agreement - look for DRAFT status (the new one)
        const agreements = await base44.entities.LegalAgreement.filter({ 
          deal_id: dealId,
          room_id: roomId 
        });
        // Prefer draft agreement (newly generated) over voided ones
        const newAgreement = agreements.find(a => a.status === 'draft') || agreements.find(a => a.status !== 'voided') || agreements[0];
        if (newAgreement) {
          setAgreement(newAgreement);
          if (onAgreementChange) onAgreementChange(newAgreement);
        }
      }
    } catch (e) {
      console.error('[AgreementPanel] Accept error:', e);
      toast.error('Failed to accept counter');
    } finally {
      setBusy(false);
    }
  };

  // Regenerate agreement (for investor after accepting counter)
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      // Get the room to fetch current terms
      const rooms = await base44.entities.Room.filter({ id: roomId });
      const currentRoom = rooms[0];
      
      if (!currentRoom) {
        toast.error('Room not found');
        setRegenerating(false);
        return;
      }

      // Determine signer mode based on who is regenerating
      const signerMode = isInvestor ? 'investor_only' : 'agent_only';

      const res = await base44.functions.invoke('generateLegalAgreement', {
        deal_id: dealId,
        room_id: roomId,
        investor_profile_id: currentRoom.investorId,
        agent_profile_ids: currentRoom.agent_ids,
        signer_mode: signerMode
      });

      if (res.data?.error) {
        toast.error(res.data.error);
        setRegenerating(false);
        return;
      }

      const newAgreement = res.data?.agreement;
      if (newAgreement) {
        setAgreement(newAgreement);
        if (onAgreementChange) onAgreementChange(newAgreement);
        toast.success('Agreement regenerated - ready for signing');
      }
    } catch (e) {
      console.error('[AgreementPanel] Regenerate error:', e);
      toast.error('Failed to regenerate agreement');
    } finally {
      setRegenerating(false);
    }
  };

  // Sign agreement (for investor)
  const handleInvestorSign = async () => {
    setBusy(true);
    try {
      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreement.id,
        role: 'investor',
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
      console.error('[AgreementPanel] Investor sign error:', e);
      toast.error('Failed to start signing');
      setBusy(false);
    }
  };

  const investorSigned = !!agreement?.investor_signed_at;
  const agentSigned = !!agreement?.agent_signed_at;
  const fullySigned = investorSigned && agentSigned;
  
  // CRITICAL LOGIC:
  // 1. Investor creates deal → agreement is created with status 'draft' or 'investor_signed'
  // 2. If investor has signed (investor_signed_at exists), agent can sign
  // 3. If counter offer was accepted, a NEW agreement is created with status 'draft' and NO signatures
  //    → Investor must sign this new agreement FIRST, then agent can sign
  
  // Agreement needs investor signature if:
  // - Agreement exists and is not voided/fully_signed
  // - AND investor has NOT signed yet
  const needsInvestorSignature = agreement && 
    !investorSigned && 
    agreement.status !== 'voided' && 
    agreement.status !== 'fully_signed';
  
  // Agreement needs agent signature if:
  // - Agreement exists
  // - AND investor HAS signed (investor_signed_at exists)
  // - AND agent has NOT signed
  // - AND agreement is not voided
  const needsAgentSignature = agreement && 
    investorSigned && 
    !agentSigned && 
    agreement.status !== 'voided';
  
  // Check if this is a fresh agreement after counter-offer acceptance (no signatures yet)
  const isFreshDraftAfterCounter = agreement && 
    agreement.status === 'draft' && 
    !investorSigned && 
    !agentSigned;

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

            {/* INVESTOR: Sign agreement (initial or after counter accepted) */}
            {isInvestor && needsInvestorSignature && (
              <div className="space-y-3">
                <div className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-xl p-4">
                  <p className="text-sm text-[#E3C567] font-semibold mb-2">
                    {isFreshDraftAfterCounter ? 'Updated Agreement Ready' : 'Sign Agreement'}
                  </p>
                  <p className="text-xs text-[#FAFAFA]/80 mb-3">
                    {isFreshDraftAfterCounter 
                      ? 'Terms have been updated after counter offer. Please sign the new agreement.'
                      : 'Please review and sign the agreement to proceed.'}
                  </p>
                  <Button
                    onClick={handleInvestorSign}
                    disabled={busy}
                    className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                  >
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Sign Agreement
                  </Button>
                </div>
              </div>
            )}

            {/* INVESTOR: Awaiting agent signature */}
            {isInvestor && investorSigned && !agentSigned && (
              <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4">
                <p className="text-sm text-[#60A5FA] font-semibold mb-1">
                  Awaiting Agent Signature
                </p>
                <p className="text-xs text-[#FAFAFA]/80">
                  You've signed. Waiting for the agent to sign.
                </p>
              </div>
            )}

            {/* AGENT: Waiting for investor to sign first (after counter accepted) */}
            {isAgent && isFreshDraftAfterCounter && (
              <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4">
                <p className="text-sm text-[#60A5FA] font-semibold mb-1">
                  Awaiting Investor Signature
                </p>
                <p className="text-xs text-[#FAFAFA]/80">
                  Updated terms accepted. Waiting for the investor to sign the new agreement first.
                </p>
              </div>
            )}

            {/* AGENT: Sign agreement (after investor has signed) */}
            {isAgent && needsAgentSignature && (
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