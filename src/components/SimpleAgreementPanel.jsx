import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, CheckCircle2, Clock, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Simplified Agreement Panel v2
 * - Load agreement on mount
 * - Generate / Sign / Counter actions
 * - Real-time subscription for updates
 */
export default function SimpleAgreementPanel({ dealId, roomId, profile, deal, onInvestorSigned, draftId, dealData, selectedAgentProfileId, agreement: externalAgreement, room: externalRoom, pendingCounters: externalPendingCounters, setPendingCounters: externalSetPendingCounters }) {
  const [agreement, setAgreement] = useState(externalAgreement || null);
  const [room, setRoom] = useState(externalRoom || null);
  const [pendingCounters, setPendingCounters] = useState([]);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const isInvestor = profile?.user_role === 'investor' || profile?.role === 'admin' || profile?.user_type === 'investor';
  const isAgent = profile?.user_role === 'agent' || profile?.user_type === 'agent';

  // Sync external agreement/room props when they change
  useEffect(() => {
    if (externalAgreement) setAgreement(externalAgreement);
  }, [externalAgreement]);
  useEffect(() => {
    if (externalRoom) setRoom(externalRoom);
  }, [externalRoom]);

  // Load agreement + room + counters on mount
  // If investor is viewing a specific agent (selectedAgentProfileId), load that agent's agreement
  useEffect(() => {
    if (!dealId) return;
    let cancelled = false;
    const load = async () => {
      let agResult = null;
      
      // If investor is viewing a specific agent, try to load that agent's DealInvite agreement
      if (selectedAgentProfileId && roomId) {
        const invites = await base44.entities.DealInvite.filter({
          deal_id: dealId, agent_profile_id: selectedAgentProfileId
        }).catch(() => []);
        const invite = invites?.[0];
        if (invite?.legal_agreement_id) {
          const agArr = await base44.entities.LegalAgreement.filter({ id: invite.legal_agreement_id }).catch(() => []);
          if (agArr?.[0] && !['superseded', 'voided'].includes(agArr[0].status)) {
            agResult = agArr[0];
          }
        }
      }
      
      // Fallback to regular getLegalAgreement
      if (!agResult) {
        const agRes = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId, room_id: roomId }).catch(() => ({ data: {} }));
        agResult = agRes?.data?.agreement || null;
      }
      
      const [roomRes, counterRes] = await Promise.all([
        roomId ? base44.entities.Room.filter({ id: roomId }).catch(() => []) : Promise.resolve([]),
        roomId ? base44.entities.CounterOffer.filter({ room_id: roomId, status: 'pending' }, '-created_date', 50).catch(() => []) : Promise.resolve([])
      ]);
      if (cancelled) return;
      if (agResult) setAgreement(agResult);
      if (roomRes?.[0]) setRoom(roomRes[0]);
      setPendingCounters(counterRes || []);
      setLoaded(true);
    };
    load();
    return () => { cancelled = true; };
  }, [dealId, roomId, selectedAgentProfileId]);

  // Real-time subscriptions
  useEffect(() => {
    if (!dealId) return;
    const unsubs = [];
    unsubs.push(base44.entities.LegalAgreement.subscribe((e) => {
      if (e?.data?.deal_id === dealId && (!roomId || e?.data?.room_id === roomId)) setAgreement(e.data);
    }));
    if (roomId) {
      unsubs.push(base44.entities.Room.subscribe((e) => {
        if (e?.data?.id === roomId) setRoom(prev => ({ ...prev, ...e.data }));
      }));
      unsubs.push(base44.entities.CounterOffer.subscribe((e) => {
        if (e?.data?.room_id === roomId) {
          if (e.data.status === 'pending') setPendingCounters(prev => [...prev.filter(c => c.id !== e.id), e.data]);
          else setPendingCounters(prev => prev.filter(c => c.id !== e.id));
        }
      }));
    }
    return () => unsubs.forEach(u => { try { u(); } catch (_) {} });
  }, [dealId, roomId]);

  // Filter counters to only show those relevant to the current agent context
  const relevantCounters = pendingCounters.filter(c => {
    // If we have a selectedAgentProfileId (investor viewing a specific agent), show only that agent's counters
    if (selectedAgentProfileId) {
      return c.from_profile_id === selectedAgentProfileId || c.to_profile_id === selectedAgentProfileId ||
        // Legacy counters without profile IDs: show if from agent role (could be any agent)
        (!c.from_profile_id && !c.to_profile_id);
    }
    // If current user is an agent, show only their own counters or counters sent to them
    if (isAgent && profile?.id) {
      return c.from_profile_id === profile.id || c.to_profile_id === profile.id ||
        // Legacy counters without profile IDs
        (!c.from_profile_id && !c.to_profile_id);
    }
    // Default: show all (investor with no specific agent selected)
    return true;
  });

  // Derived state — handle per-agent regeneration awareness
  // When an agent's counter offer was accepted, only THAT agent sees requires_regenerate.
  // Other agents should still see the original agreement as signable.
  const isAgentOnlyMode = agreement?.signer_mode === 'agent_only';
  
  // Determine if THIS specific agent has a pending regeneration
  const agentSpecificRegen = (() => {
    if (!isAgent || !profile?.id || !room) return false;
    // Check agent_terms for this agent's requires_regenerate flag
    const myTerms = room?.agent_terms?.[profile.id];
    if (myTerms?.requires_regenerate) return true;
    return false;
  })();
  
  // For investors viewing a specific agent: check that specific agent's requires_regenerate
  // For investors with no agent selected: use room-level requires_regenerate
  // For agents: only show regen if it's THEIR counter that was accepted
  const needsRegen = (() => {
    if (isAgent) return agentSpecificRegen;
    if (isInvestor && selectedAgentProfileId) {
      // Check if this specific agent has requires_regenerate
      const agentTerms = room?.agent_terms?.[selectedAgentProfileId];
      return agentTerms?.requires_regenerate === true;
    }
    // Investor with no specific agent — show room-level flag
    return room?.requires_regenerate === true;
  })();
  
  // For agents who DIDN'T counter: they see the original agreement which IS investor-signed
  // needsRegen should be false for them, so investorSigned will correctly be true
  const investorSigned = !needsRegen && (
    !!agreement?.investor_signed_at ||
    agreement?.status === 'investor_signed' ||
    agreement?.status === 'fully_signed' ||
    isAgentOnlyMode // agent_only means investor already signed the base agreement
  );
  const agentSigned = !needsRegen && (!!agreement?.agent_signed_at || agreement?.status === 'agent_signed' || agreement?.status === 'fully_signed');
  const fullySigned = investorSigned && agentSigned;

  // Generate agreement (investor only, first time)
  const handleGenerate = async () => {
    setBusy(true);
    try {
      const exhibit_a = {
        buyer_commission_type: dealData?.buyerCommissionType || 'percentage',
        buyer_commission_percentage: dealData?.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
        buyer_flat_fee: dealData?.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
        agreement_length_days: dealData?.agreementLength ? Number(dealData.agreementLength) : 180,
        transaction_type: 'ASSIGNMENT'
      };
      // If dealData.dealId exists, this is an edit of an existing deal — use deal_id directly
      const isEditingExistingDeal = !!dealData?.dealId;
      const res = await base44.functions.invoke('generateLegalAgreement', {
        draft_id: isEditingExistingDeal ? undefined : (draftId || undefined),
        deal_id: isEditingExistingDeal ? dealData.dealId : (draftId ? undefined : dealId),
        room_id: isEditingExistingDeal ? roomId : undefined,
        signer_mode: 'investor_only', exhibit_a, investor_profile_id: profile?.id,
        property_address: dealData?.propertyAddress, city: dealData?.city,
        state: dealData?.state, zip: dealData?.zip, county: dealData?.county
      });
      if (res.data?.agreement) { setAgreement(res.data.agreement); toast.success('Agreement ready'); }
      else toast.error(res.data?.error || 'Generation failed');
    } catch (e) { toast.error(e?.response?.data?.error || 'Generation failed'); }
    finally { setBusy(false); }
  };

  // Sign agreement
  const handleSign = async (role) => {
    setBusy(true);
    try {
      // Agent signs the SAME envelope as investor — no regeneration needed.
      // If the agent isn't yet a recipient on the envelope, the backend will add them.
      let targetId = agreement?.id;
      if (role === 'agent' && (!agreement?.agent_recipient_id || !agreement?.agent_client_user_id)) {
        // Agent recipient data is missing — need to add agent to the existing envelope
        console.log('[SimpleAgreementPanel] Agent missing recipient data, calling addAgentToEnvelope. signer_mode:', agreement?.signer_mode);
        const prepRes = await base44.functions.invoke('addAgentToEnvelope', {
          agreement_id: agreement.id, room_id: roomId
        });
        if (prepRes.data?.agreement?.id) { targetId = prepRes.data.agreement.id; setAgreement(prepRes.data.agreement); }
        else if (prepRes.data?.error) { toast.error(prepRes.data.error); setBusy(false); return; }
        await new Promise(r => setTimeout(r, 1500)); // Wait for DocuSign to process
      }
      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: targetId, role, room_id: roomId,
        redirect_url: window.location.href.split('&signed')[0] + '&signed=1'
      });
      if (res.data?.signing_url) window.location.assign(res.data.signing_url);
      else if (res.data?.already_signed) { toast.success('Already signed'); if (role === 'investor' && onInvestorSigned) onInvestorSigned(); }
      else toast.error(res.data?.error || 'Failed to start signing');
    } catch (e) { toast.error(e?.response?.data?.error || 'Signing failed'); }
    finally { setBusy(false); }
  };

  // Regenerate + sign (after counter accepted) — generates a NEW agreement for the specific agent
  const handleRegenAndSign = async () => {
    setBusy(true);
    try {
      // Pass the specific agent whose counter was accepted so regeneration targets the right agent
      const targetAgent = selectedAgentProfileId || null;
      const res = await base44.functions.invoke('regenerateActiveAgreement', { deal_id: dealId, room_id: roomId, target_agent_id: targetAgent });
      if (res.data?.error) { toast.error(res.data.error); setBusy(false); return; }
      if (res.data?.agreement) {
        setAgreement(res.data.agreement);
        if (roomId) { const r = await base44.entities.Room.filter({ id: roomId }); if (r?.[0]) setRoom(r[0]); }
        await new Promise(r => setTimeout(r, 2000));
        const signRes = await base44.functions.invoke('docusignCreateSigningSession', {
          agreement_id: res.data.agreement.id, role: 'investor', room_id: roomId,
          redirect_url: window.location.href.split('&signed')[0] + '&signed=1'
        });
        if (signRes.data?.signing_url) { window.location.assign(signRes.data.signing_url); return; }
        toast.error(signRes.data?.error || 'Failed to start signing');
      }
    } catch (e) { toast.error(e?.response?.data?.error || 'Failed'); }
    finally { setBusy(false); }
  };

  // Counter offer response
  const handleCounterResponse = async (counterId, action) => {
    try {
      const res = await base44.functions.invoke('respondToCounterOffer', { counter_offer_id: counterId, action });
      if (res.data?.success) {
        toast.success(`Counter ${action}ed`);
        setPendingCounters(prev => prev.filter(c => c.id !== counterId));
        if (action === 'accept') setRoom(prev => ({ ...prev, requires_regenerate: true }));
      } else toast.error(res.data?.error || 'Failed');
    } catch (e) { toast.error('Failed to respond'); }
  };

  // Handle post-signing redirect — poll a few times to catch async automation updates
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === '1' && dealId) {
      let attempts = 0;
      const poll = async () => {
        attempts++;
        const res = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId, room_id: roomId });
        const ag = res?.data?.agreement;
        if (ag) {
          setAgreement(ag);
          // If investor signed, trigger callback
          if (ag.investor_signed_at && onInvestorSigned) {
            onInvestorSigned();
            return;
          }
        }
        if (roomId) { const r = await base44.entities.Room.filter({ id: roomId }); if (r?.[0]) setRoom(r[0]); }
        // Retry up to 4 times (total ~10s) since automation may still be processing
        if (attempts < 4 && (!ag?.investor_signed_at)) {
          setTimeout(poll, 2500);
        }
      };
      setTimeout(poll, 1500);
    }
  }, [dealId, roomId]);

  if (!loaded) return <Card className="bg-[#0D0D0D] border-[#1F1F1F]"><CardContent className="p-6 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-[#808080]" /></CardContent></Card>;

  return (
    <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
      <CardHeader className="border-b border-[#1F1F1F]">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-[#FAFAFA]">Agreement & Terms</CardTitle>
          {agreement && (
            <Badge className="bg-transparent border-[#1F1F1F]">
              {fullySigned ? <span className="text-green-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Signed</span>
                : investorSigned ? <span className="text-yellow-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Awaiting Agent</span>
                : <span className="text-blue-400 flex items-center gap-1"><Clock className="w-3 h-3" /> Pending</span>}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {/* No agreement yet */}
        {!agreement && !investorSigned && (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-[#E3C567] mx-auto mb-4" />
            <p className="text-[#808080] mb-4">No agreement yet</p>
            {isInvestor && <Button onClick={handleGenerate} disabled={busy} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black">{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Generate Agreement</Button>}
          </div>
        )}

        {/* Agreement exists */}
        {agreement && (
          <div className="space-y-4">
            {/* Status grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141414] rounded-xl p-4">
                <p className="text-xs text-[#808080] mb-1">Investor</p>
                <p className={investorSigned ? "text-green-400 text-sm font-semibold" : "text-[#808080] text-sm"}>{investorSigned ? '✓ Signed' : 'Pending'}</p>
              </div>
              <div className="bg-[#141414] rounded-xl p-4">
                <p className="text-xs text-[#808080] mb-1">Agent</p>
                <p className={agentSigned ? "text-green-400 text-sm font-semibold" : "text-[#808080] text-sm"}>{agentSigned ? '✓ Signed' : 'Pending'}</p>
              </div>
            </div>

            {/* Investor actions */}
            {isInvestor && !fullySigned && (
              <>
                {needsRegen && !isAgentOnlyMode && selectedAgentProfileId && (
                  <Button onClick={handleRegenAndSign} disabled={busy} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Regenerate & Sign (Updated Terms)
                  </Button>
                )}
                {needsRegen && !isAgentOnlyMode && !selectedAgentProfileId && (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                    <p className="text-sm text-[#FAFAFA]">A counter offer was accepted. Select the agent to regenerate their agreement.</p>
                  </div>
                )}
                {!investorSigned && !needsRegen && !isAgentOnlyMode && agreement.status !== 'superseded' && (
                  <Button onClick={() => handleSign('investor')} disabled={busy} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                    {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sign Agreement
                  </Button>
                )}
                {investorSigned && !agentSigned && !needsRegen && (
                  <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center"><p className="text-sm text-[#FAFAFA]">Waiting for agent to sign</p></div>
                )}
              </>
            )}

            {/* Agent actions */}
            {isAgent && !fullySigned && (
              <>
                {investorSigned && !agentSigned && relevantCounters.length === 0 && (
                  <div className="space-y-2">
                    <Button onClick={() => handleSign('agent')} disabled={busy} className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black">
                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Sign Agreement
                    </Button>
                    <Button onClick={() => window.location.href = `/CounterOffer?dealId=${dealId}&roomId=${roomId}`} variant="outline" className="w-full border-[#1F1F1F] text-[#FAFAFA]">
                      Make Counter Offer
                    </Button>
                  </div>
                )}
                {!investorSigned && !needsRegen && (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center"><p className="text-sm text-[#FAFAFA]">Waiting for investor to sign first</p></div>
                )}
                {needsRegen && (
                  <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center"><p className="text-sm text-[#FAFAFA]">Waiting for investor to regenerate with new terms</p></div>
                )}
              </>
            )}

            {/* Pending counter offers — filtered to relevant agent */}
            {relevantCounters.map(counter => (
              <div key={counter.id} className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-xl p-4">
                <p className="text-xs text-[#E3C567] mb-2 font-semibold">{counter.from_role === 'investor' ? 'Investor' : 'Agent'} Counter Offer</p>
                <div className="text-sm text-[#FAFAFA] mb-3">
                  <p>Buyer Commission: {counter.terms_delta?.buyer_commission_type === 'percentage' ? `${counter.terms_delta.buyer_commission_percentage}%` : `$${counter.terms_delta?.buyer_flat_fee?.toLocaleString()}`}</p>
                </div>
                {((counter.from_role === 'agent' && isInvestor) || (counter.from_role === 'investor' && isAgent)) && (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleCounterResponse(counter.id, 'accept')} className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs">Accept</Button>
                    <Button size="sm" onClick={() => handleCounterResponse(counter.id, 'decline')} variant="outline" className="flex-1 border-[#1F1F1F] text-[#FAFAFA] text-xs">Decline</Button>
                  </div>
                )}
                {counter.from_role === (isInvestor ? 'investor' : 'agent') && (
                  <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-center"><p className="text-xs text-blue-300">Pending Review</p></div>
                )}
              </div>
            ))}

            {/* Fully signed */}
            {fullySigned && (
              <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-2" />
                <p className="text-sm text-[#FAFAFA] font-semibold">Fully Signed</p>
              </div>
            )}

            {/* Download */}
            {agreement?.signed_pdf_url && (
              <Button onClick={() => window.open(agreement.signed_pdf_url, '_blank')} variant="outline" className="w-full"><Download className="w-4 h-4 mr-2" />Download PDF</Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}