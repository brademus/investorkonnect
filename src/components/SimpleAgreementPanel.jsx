import React, { useState, useEffect } from 'react';
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
 * - Call onInvestorSigned callback after investor signs
 */
export default function SimpleAgreementPanel({ dealId, roomId, agreement, profile, deal, room, onInvestorSigned, onCounterReceived, onCounterUpdate, onRoomUpdate, pendingCounters: incomingCounters, setPendingCounters: setIncomingCounters }) {
  const [busy, setBusy] = useState(false);
    const [confirmModal, setConfirmModal] = useState(false);
    const [localAgreement, setLocalAgreement] = useState(agreement);
    const [pendingCounters, setPendingCounters] = useState(incomingCounters || []);
    const [debugError, setDebugError] = useState(null);

  // Sync prop changes to local state only if truly different (avoid flickering from stale parent data)
  // Also track room state for regenerate requirement check
  const [localRoom, setLocalRoom] = React.useState(room);
  React.useEffect(() => {
    if (agreement && agreement.id !== localAgreement?.id) {
      setLocalAgreement(agreement);
    }
    if (room && room.id !== localRoom?.id) {
      setLocalRoom(room);
    }
  }, [agreement?.id, room?.id]);

  // Fetch latest agreement on panel load to ensure we have current signatures
  React.useEffect(() => {
    if (!dealId) return;

    const fetchLatest = async () => {
      try {
        const res = await base44.functions.invoke('getLegalAgreement', { 
          deal_id: dealId, 
          room_id: roomId || undefined 
        });
        if (res?.data?.agreement) {
          setLocalAgreement(res.data.agreement);
        }
      } catch (e) {
        console.error('[SimpleAgreementPanel] Fetch latest error:', e);
      }
    };

    fetchLatest();
  }, [dealId, roomId]);

  // Sync incoming counters from Room component and trigger refresh
    React.useEffect(() => {
      if (incomingCounters) {
        setPendingCounters(incomingCounters);
        // Also update parent state if setter provided
        if (setIncomingCounters) {
          setIncomingCounters(incomingCounters);
        }
        // Force refresh agreement when counters change (arrival, acceptance, decline)
        const fetchLatest = async () => {
          try {
            const res = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId, room_id: roomId });
            if (res?.data?.agreement) {
              setLocalAgreement(res.data.agreement);
            }
            // Also refresh room state to get updated requires_regenerate flag
            if (roomId) {
              const roomRes = await base44.entities.Room.filter({ id: roomId });
              if (roomRes?.[0]) {
                setLocalRoom(roomRes[0]);
              }
            }
          } catch (_) {}
        };
        setTimeout(fetchLatest, 300);
      }
    }, [incomingCounters]);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  
  // CRITICAL: Check BOTH agreement and room for signed status (room updated faster after DocuSign)
  // IMPORTANT: Only trust investor_signed if status is NOT 'draft' or 'sent' (fresh agreements shouldn't be marked signed)
  const investorSigned = (!!localAgreement?.investor_signed_at && localAgreement?.status !== 'draft' && localAgreement?.status !== 'sent') 
    || (localRoom?.agreement_status === 'investor_signed' && localRoom?.agreement_status !== 'draft')
    || localRoom?.agreement_status === 'fully_signed';
  const agentSigned = (!!localAgreement?.agent_signed_at && localAgreement?.status !== 'draft' && localAgreement?.status !== 'sent')
    || (localRoom?.agreement_status === 'agent_signed' && localRoom?.agreement_status !== 'draft')
    || localRoom?.agreement_status === 'fully_signed';
  const fullySigned = investorSigned && agentSigned;

  // Check BOTH agreement and pass-in flag for regenerate requirement
  // CRITICAL: Check Room.requires_regenerate (NOT agreement.requires_regenerate which is never set)
  // This flag is set server-side when counter is accepted and drives regeneration requirement
  const requiresRegenerate = localRoom?.requires_regenerate === true || pendingCounters.some(c => c.status === 'accepted');
  const canRegenerate = !fullySigned && requiresRegenerate;

  // CRITICAL: Don't show generate form if investor already signed (unless counter requires regeneration)
  const showGenerateForm = isInvestor && (!localAgreement || localAgreement.status === 'draft' || localAgreement.status === 'superseded') && !investorSigned && !canRegenerate;

  // Handle generate agreement
  const handleGenerate = async () => {
    setBusy(true);
    toast.loading('Generating...', { id: 'gen' });

    try {
      const res = await base44.functions.invoke('regenerateActiveAgreement', {
        deal_id: dealId,
        room_id: roomId
      });

      toast.dismiss('gen');

      if (res.data?.error) {
        console.error('[SimpleAgreementPanel] Generate error:', res.data);
        toast.error(res.data.error || 'Generation failed');
      } else if (res.data?.agreement) {
        setLocalAgreement(res.data.agreement);
        toast.success('Agreement ready');
      } else {
        toast.error('Unexpected response format');
      }
    } catch (e) {
      toast.dismiss('gen');
      console.error('[SimpleAgreementPanel] Generate exception:', e);
      toast.error(e?.response?.data?.error || e?.message || 'Generation failed');
    } finally {
      setBusy(false);
    }
  };

  // Handle sign
  const handleSign = async (role) => {
    setBusy(true);

    try {
      if (!localAgreement?.id) {
        toast.error('No agreement to sign');
        setBusy(false);
        return;
      }

      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: localAgreement.id,
        role,
        room_id: roomId,
        redirect_url: window.location.href + '&signed=1'
      });

      if (res.data?.already_signed) {
        toast.success('Already signed');
        setBusy(false);
        if (role === 'investor' && onInvestorSigned) {
          onInvestorSigned();
        }
        return;
      }

      if (res.data?.signing_url) {
        window.location.assign(res.data.signing_url);
      } else {
        console.error('[SimpleAgreementPanel] No signing URL:', res.data);
        toast.error(res.data?.error || 'Failed to start signing');
        setBusy(false);
      }
    } catch (e) {
      console.error('[SimpleAgreementPanel] Signing error:', e);
      toast.error(e?.response?.data?.error || e?.message || 'Signing failed');
      setBusy(false);
    }
  };

  // Subscribe to real-time agreement updates (room-scoped)
  React.useEffect(() => {
   if (!dealId || !roomId) return;

   const unsubscribe = base44.entities.LegalAgreement.subscribe((event) => {
     // Only update if this agreement is for this specific room
     if (event?.data?.deal_id === dealId && event?.data?.room_id === roomId) {
       setLocalAgreement(prev => {
         // Only update if signing status actually changed (prevents flickering)
         if (prev?.investor_signed_at === event.data.investor_signed_at && 
             prev?.agent_signed_at === event.data.agent_signed_at &&
             prev?.status === event.data.status) {
           return prev;
         }
         return { ...prev, ...event.data };
       });
     }
    });

    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
   }, [dealId, roomId]);

  // Subscribe to room updates to track requires_regenerate flag
  React.useEffect(() => {
   if (!roomId) return;

   const unsubscribe = base44.entities.Room.subscribe((event) => {
     if (event?.data?.id === roomId) {
       setLocalRoom(prev => {
         // Update if requires_regenerate changed
         if (prev?.requires_regenerate === event.data.requires_regenerate &&
             prev?.proposed_terms === event.data.proposed_terms) {
           return prev;
         }
         return { ...prev, ...event.data };
       });
     }
   });

   return () => {
     try { unsubscribe?.(); } catch (_) {}
   };
  }, [roomId]);

  // CRITICAL: Only trigger callback once after signing, not on every load
  const [hasTriggeredCallback, setHasTriggeredCallback] = useState(false);
  useEffect(() => {
    if (localAgreement?.investor_signed_at && !localAgreement?.agent_signed_at && onInvestorSigned && !hasTriggeredCallback) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signed') === '1') {
        setHasTriggeredCallback(true);
        onInvestorSigned();
      }
    }
  }, [localAgreement?.investor_signed_at, onInvestorSigned, hasTriggeredCallback]);

  // Refresh agreement after signing redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === '1' && dealId && !localAgreement?.investor_signed_at) {
      // Small delay to ensure DocuSign has synced
      const timer = setTimeout(async () => {
        try {
          const res = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
          if (res?.data?.agreement) {
            setLocalAgreement(res.data.agreement);
          }
        } catch (_) {}
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [dealId]);

  return (
    <>
      <Card className="bg-[#0D0D0D] border-[#1F1F1F]">
        <CardHeader className="border-b border-[#1F1F1F]">
           <div className="flex items-center justify-between">
             <CardTitle className="text-lg text-[#FAFAFA]">Agreement & Terms</CardTitle>
             {localAgreement && (
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
           {/* Debug Error Display */}
           {debugError && (
             <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3">
               <p className="text-xs text-red-300">{debugError}</p>
               <button 
                 onClick={() => setDebugError(null)}
                 className="text-xs text-red-400 hover:text-red-300 mt-2 underline"
               >
                 Dismiss
               </button>
             </div>
           )}

           {/* No Agreement Yet */}
           {!localAgreement && !investorSigned && (
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
          
          {/* Show status message if investor already signed but no agreement object loaded yet */}
          {!localAgreement && investorSigned && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-[#10B981] mx-auto mb-4" />
              <p className="text-[#FAFAFA] font-semibold mb-2">You've already signed</p>
              <p className="text-sm text-[#808080]">Waiting for agent to sign</p>
            </div>
          )}

          {/* Agreement Exists */}
          {localAgreement && (
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
                 {!investorSigned && !canRegenerate && localAgreement && (
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
                                      onClick={async () => {
                                        // Auto-regenerate AND sign in one flow
                                        setBusy(true);
                                        toast.loading('Regenerating...', { id: 'regen' });
                                        try {
                                          const res = await base44.functions.invoke('regenerateActiveAgreement', {
                                            deal_id: dealId,
                                            room_id: roomId
                                          });
                                          toast.dismiss('regen');
                                          if (res.data?.error) {
                                            toast.error(res.data.error);
                                            setBusy(false);
                                            return;
                                          }
                                          if (res.data?.agreement) {
                                            setLocalAgreement(res.data.agreement);
                                            // Refresh room to reflect new draft status
                                            if (roomId) {
                                              const roomRes = await base44.entities.Room.filter({ id: roomId });
                                              if (roomRes?.[0]) {
                                                setLocalRoom(roomRes[0]);
                                              }
                                            }
                                            // If regeneration returned a signing URL, redirect immediately
                                            if (res.data?.signing_url) {
                                              toast.success('Redirecting to DocuSign...');
                                              setTimeout(() => window.location.assign(res.data.signing_url), 300);
                                              return;
                                            }
                                            // Otherwise, create signing session
                                            toast.success('Agreement ready, redirecting to sign...');
                                            setTimeout(async () => {
                                              try {
                                                if (!res.data.agreement?.id) {
                                                  setDebugError('Agreement ID missing from regeneration response');
                                                  toast.error('Agreement ID missing');
                                                  setBusy(false);
                                                  return;
                                                }
                                                const baseUrl = window.location.href.split('&signed')[0];
                                                const signRes = await base44.functions.invoke('docusignCreateSigningSession', {
                                                  agreement_id: res.data.agreement.id,
                                                  role: 'investor',
                                                  room_id: roomId,
                                                  redirect_url: baseUrl + '&signed=1'
                                                });
                                                if (signRes.data?.signing_url) {
                                                  window.location.assign(signRes.data.signing_url);
                                                } else {
                                                  const errorMsg = signRes.data?.error || 'Failed to get signing URL';
                                                  setDebugError(errorMsg);
                                                  toast.error(errorMsg);
                                                  setBusy(false);
                                                }
                                              } catch (e) {
                                                console.error('[SimpleAgreementPanel] Signing after regenerate error:', e);
                                                const errorMsg = e?.response?.data?.error || e?.message || 'Failed to start signing';
                                                setDebugError(errorMsg);
                                                toast.error(errorMsg);
                                                setBusy(false);
                                              }
                                            }, 800);
                                            return;
                                          }
                                        } catch (e) {
                                          toast.dismiss('regen');
                                          console.error('[SimpleAgreementPanel] Regenerate error:', e);
                                          toast.error(e?.response?.data?.error || e?.message || 'Failed to regenerate');
                                          setBusy(false);
                                        }
                                      }}
                                      disabled={busy}
                                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                                    >
                                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                      Regenerate & Sign
                                    </Button>
                                  )}

                  {investorSigned && !agentSigned && !canRegenerate && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for agent to sign</p>
                    </div>
                  )}
               </div>
              )}

              {/* Agent Actions */}
              {isAgent && !fullySigned && (
                <div className="space-y-3">
                  {!investorSigned && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to sign first</p>
                    </div>
                  )}

                  {investorSigned && (requiresRegenerate || pendingCounters.some(c => c.status === 'accepted')) && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to regenerate and sign with the new terms</p>
                    </div>
                  )}

                  {/* Show if agent has already countered */}
                  {investorSigned && !agentSigned && !requiresRegenerate && pendingCounters.some(c => c.from_role === 'agent' && c.status === 'pending') && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to review your counter offer</p>
                    </div>
                  )}

                  {/* Show sign/counter buttons only if: investor signed NEW agreement, no pending counters, and not regenerating */}
                  {investorSigned && !agentSigned && !requiresRegenerate && !pendingCounters.some(c => c.status === 'accepted' || c.status === 'pending') && (
                    <>
                      <Button
                        onClick={() => handleSign('agent')}
                        disabled={busy}
                        className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      >
                        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Sign as Agent
                      </Button>
                      <Button
                        onClick={() => window.location.href = `/CounterOffer?dealId=${dealId}&roomId=${roomId}`}
                        variant="outline"
                        className="w-full border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414]"
                      >
                        Make Counter Offer
                      </Button>
                    </>
                  )}


                </div>
              )}

              {/* Pending Counter Offers */}
              {pendingCounters.length > 0 && (
                <div className="space-y-3">
                  {pendingCounters.map((counter) => (
                    <div key={counter.id} className="bg-[#E3C567]/10 border border-[#E3C567]/30 rounded-xl p-4">
                      <p className="text-xs text-[#E3C567] mb-3 font-semibold">
                        {counter.from_role === 'investor' ? 'Investor' : 'Agent'} Counter Offer
                      </p>
                      <div className="text-sm text-[#FAFAFA] mb-3">
                        <p>Buyer Commission: {counter.terms_delta.buyer_commission_type === 'percentage'
                          ? `${counter.terms_delta.buyer_commission_percentage}%`
                          : `$${counter.terms_delta.buyer_flat_fee?.toLocaleString()}`}</p>
                      </div>
                      {counter.from_role === 'agent' && isAgent ? (
                        <div className="bg-blue-500/20 border border-blue-400/30 rounded-lg p-3 text-center">
                          <p className="text-xs text-blue-300 font-semibold">Pending Investor Review</p>
                        </div>
                      ) : counter.from_role === 'agent' && isInvestor ? (
                       <div className="flex gap-2 flex-col">
                         <div className="flex gap-2">
                           <Button
                             size="sm"
                             onClick={async () => {
                               try {
                                 const res = await base44.functions.invoke('respondToCounterOffer', {
                                   counter_offer_id: counter.id,
                                   action: 'accept'
                                 });
                                 if (res.data?.error) {
                                   toast.error(res.data.error);
                                   return;
                                 }
                                 toast.success('Counter accepted - Regenerate agreement to continue');
                                 setPendingCounters(pendingCounters.filter(c => c.id !== counter.id));
                                 if (setIncomingCounters) setIncomingCounters(pendingCounters.filter(c => c.id !== counter.id));

                                 // Refresh room to get updated requires_regenerate flag
                                 setTimeout(async () => {
                                   try {
                                     const roomRes = await base44.entities.Room.filter({ id: roomId });
                                     if (roomRes?.[0]) {
                                       setLocalRoom(roomRes[0]);
                                     }
                                   } catch (_) {}
                                 }, 500);

                                 if (onCounterReceived) onCounterReceived();
                               } catch (e) {
                                 console.error('[SimpleAgreementPanel] Accept error:', e);
                                 toast.error(e?.response?.data?.error || e?.message || 'Failed to accept counter');
                               }
                             }}
                             className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                           >
                             Accept
                           </Button>
                           <Button
                             size="sm"
                             onClick={async () => {
                               try {
                                 await base44.functions.invoke('respondToCounterOffer', {
                                   counter_offer_id: counter.id,
                                   action: 'decline'
                                 });
                                 toast.success('Counter declined');
                                 setPendingCounters(pendingCounters.filter(c => c.id !== counter.id));
                               } catch (e) {
                                 toast.error('Failed to decline counter');
                               }
                             }}
                             variant="outline"
                             size="sm"
                             className="flex-1 border-[#1F1F1F] text-[#FAFAFA] text-xs"
                           >
                             Decline
                           </Button>
                         </div>
                         <Button
                           size="sm"
                           onClick={() => window.location.href = `/CounterOffer?dealId=${dealId}&roomId=${roomId}&respondingTo=${counter.id}`}
                           variant="outline"
                           className="w-full border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10 text-xs"
                         >
                           Counter Offer Back
                         </Button>
                       </div>
                      ) : counter.from_role === 'investor' && isAgent ? (
                        <div className="flex gap-2 flex-col">
                          <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={async () => {
                                  try {
                                    const res = await base44.functions.invoke('respondToCounterOffer', {
                                      counter_offer_id: counter.id,
                                      action: 'accept'
                                    });
                                    if (res.data?.error) {
                                      toast.error(res.data.error);
                                      return;
                                    }
                                    if (!res.data?.success) {
                                      toast.error('Counter acceptance failed');
                                      return;
                                    }
                                    toast.success('Counter accepted - Regenerate agreement to continue');
                                    setPendingCounters(pendingCounters.filter(c => c.id !== counter.id));
                                    if (setIncomingCounters) setIncomingCounters(pendingCounters.filter(c => c.id !== counter.id));
                                    // Refresh room to get updated terms and regenerate flag
                                    setTimeout(async () => {
                                      try {
                                        const roomRes = await base44.entities.Room.filter({ id: roomId });
                                        if (roomRes?.[0]) {
                                          setLocalRoom(roomRes[0]);
                                          if (onRoomUpdate) onRoomUpdate(roomRes[0]);
                                        }
                                        // Also refresh deal to sync updated proposed_terms to parent
                                        const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
                                        if (onCounterUpdate) onCounterUpdate(dealRes?.data?.deal || dealRes?.data);
                                      } catch (_) {}
                                    }, 300);
                                    if (onCounterReceived) onCounterReceived();
                                  } catch (e) {
                                    console.error('[SimpleAgreementPanel] Accept error:', e);
                                    const errMsg = e?.response?.data?.error || e?.message || 'Failed to accept counter';
                                    toast.error(errMsg);
                                  }
                                }}
                                className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white text-xs"
                              >
                                Accept
                              </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                try {
                                  await base44.functions.invoke('respondToCounterOffer', {
                                    counter_offer_id: counter.id,
                                    action: 'decline'
                                  });
                                  toast.success('Counter declined');
                                  setPendingCounters(pendingCounters.filter(c => c.id !== counter.id));
                                } catch (e) {
                                  toast.error('Failed to decline counter');
                                }
                              }}
                              variant="outline"
                              size="sm"
                              className="flex-1 border-[#1F1F1F] text-[#FAFAFA] text-xs"
                            >
                              Decline
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => window.location.href = `/CounterOffer?dealId=${dealId}&roomId=${roomId}&respondingTo=${counter.id}`}
                            variant="outline"
                            className="w-full border-[#E3C567] text-[#E3C567] hover:bg-[#E3C567]/10 text-xs"
                          >
                            Counter Offer Back
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
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
              {localAgreement?.signed_pdf_url && (
                <Button
                  onClick={() => window.open(localAgreement.signed_pdf_url, '_blank')}
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