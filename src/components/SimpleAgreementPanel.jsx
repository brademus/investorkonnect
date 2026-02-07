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
export default function SimpleAgreementPanel({ dealId, roomId, agreement, profile, deal, room, onInvestorSigned, onCounterReceived, onCounterUpdate, onRoomUpdate, pendingCounters: incomingCounters, setPendingCounters: setIncomingCounters, draftId, dealData }) {
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

  // Fetch latest agreement on panel load AND when room's current_legal_agreement_id changes
  React.useEffect(() => {
    if (!dealId) return;

    const fetchLatest = async () => {
      try {
        // CRITICAL: Try room-scoped first, then fall back to deal-level
        let res = await base44.functions.invoke('getLegalAgreement', { 
          deal_id: dealId, 
          room_id: roomId || undefined 
        });

        // If room-scoped is draft/unsigned or missing, try deal-level as fallback
        if (roomId && (!res?.data?.agreement?.investor_signed_at || res?.data?.agreement?.status === 'draft')) {
          console.log('[SimpleAgreementPanel] Room-scoped agreement unsigned/draft, checking deal-level...');
          const dealRes = await base44.functions.invoke('getLegalAgreement', { 
            deal_id: dealId 
          });
          if (dealRes?.data?.agreement?.investor_signed_at) {
            console.log('[SimpleAgreementPanel] Found signed deal-level agreement, using that');
            res = dealRes;
          }
        }
        
        if (res?.data?.agreement) {
          console.log('[SimpleAgreementPanel] Loaded agreement:', {
            id: res.data.agreement.id,
            status: res.data.agreement.status,
            investor_signed: !!res.data.agreement.investor_signed_at,
            agent_signed: !!res.data.agreement.agent_signed_at,
            room_id: res.data.agreement.room_id,
            is_room_scoped: !!res.data.agreement.room_id
          });
          setLocalAgreement(res.data.agreement);
        } else {
          console.log('[SimpleAgreementPanel] No agreement found for deal:', dealId, 'room:', roomId);
        }

        // Also refresh room to sync requires_regenerate flag and agreement_status
        if (roomId) {
          const roomRes = await base44.entities.Room.filter({ id: roomId });
          if (roomRes?.[0]) {
            console.log('[SimpleAgreementPanel] Loaded room:', {
              id: roomRes[0].id,
              requires_regenerate: roomRes[0].requires_regenerate,
              agreement_status: roomRes[0].agreement_status,
              is_fully_signed: roomRes[0].is_fully_signed,
              investor_signed_at: roomRes[0].ioa_investor_signed_at
            });
            setLocalRoom(roomRes[0]);
          }
        }
      } catch (e) {
        console.error('[SimpleAgreementPanel] Fetch latest error:', e);
      }
    };

    fetchLatest();
  }, [dealId, roomId, localRoom?.current_legal_agreement_id]);

  // Sync incoming counters from Room component and trigger refresh
    React.useEffect(() => {
      if (incomingCounters) {
        // CRITICAL: Only show PENDING counters, filter out accepted/completed
        const activePending = (incomingCounters || []).filter(c => c.status === 'pending');
        setPendingCounters(activePending);
        // Also update parent state if setter provided
        if (setIncomingCounters) {
          setIncomingCounters(activePending);
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
    }, [incomingCounters?.length]);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  
  // CRITICAL: When requires_regenerate is true, IGNORE old signatures (fresh start needed)
  const requiresRegenerate = localRoom?.requires_regenerate === true;

  // CRITICAL: Check investor signature - prefer current agreement, fallback to room/deal
  const investorSigned = requiresRegenerate 
    ? false // If regeneration needed, ignore old signatures
    : (!!localAgreement?.investor_signed_at && localAgreement?.status !== 'superseded' && localAgreement?.status !== 'voided') ||
      localAgreement?.status === 'investor_signed' ||
      localAgreement?.status === 'agent_signed' ||
      localAgreement?.status === 'fully_signed' ||
      localRoom?.agreement_status === 'investor_signed' ||
      localRoom?.agreement_status === 'fully_signed' ||
      !!deal?.investor_signed_at ||
      !!deal?.ioa_investor_signed_at;
      
  const agentSigned = requiresRegenerate
    ? false // If regeneration needed, ignore old signatures
    : (!!localAgreement?.agent_signed_at && localAgreement?.status !== 'superseded' && localAgreement?.status !== 'voided') ||
      localAgreement?.status === 'agent_signed' ||
      localAgreement?.status === 'fully_signed' ||
      localRoom?.agreement_status === 'agent_signed' ||
      localRoom?.agreement_status === 'fully_signed' ||
      !!deal?.agent_signed_at;

  // Check multiple sources for fully signed status
  const fullySigned = investorSigned && agentSigned || 
                      localRoom?.agreement_status === 'fully_signed' || 
                      localRoom?.is_fully_signed === true ||
                      deal?.is_fully_signed === true ||
                      localAgreement?.status === 'fully_signed';
  
  console.log('[SimpleAgreementPanel] Signature status:', {
    investorSigned,
    agentSigned,
    fullySigned,
    roomStatus: localRoom?.agreement_status,
    agreementStatus: localAgreement?.status,
    agreementInvestorSigned: !!localAgreement?.investor_signed_at,
    roomInvestorSigned: !!localRoom?.ioa_investor_signed_at,
    dealInvestorSigned: !!deal?.ioa_investor_signed_at
  });

  // Show regenerate button ONLY when requires_regenerate is true AND investor hasn't signed the NEW agreement
  const canRegenerate = requiresRegenerate && !investorSigned;
  
  console.log('[SimpleAgreementPanel] Regenerate check:', {
    requiresRegenerate,
    investorSigned,
    canRegenerate,
    localRoomRequiresRegenerate: localRoom?.requires_regenerate
  });

  // Show generate form only for initial agreement creation (not after counter acceptance)
  const showGenerateForm = isInvestor && (!localAgreement || localAgreement.status === 'draft') && !requiresRegenerate && !investorSigned;

  // Handle generate agreement
  const handleGenerate = async () => {
    setBusy(true);
    toast.loading('Generating...', { id: 'gen' });

    try {
      if (!draftId && !dealId) {
        toast.dismiss('gen');
        toast.error('Deal context missing');
        setBusy(false);
        return;
      }

      // Build exhibit_a from dealData (buyer commission structure)
      const exhibit_a = {
        buyer_commission_type: dealData?.buyerCommissionType || 'percentage',
        buyer_commission_percentage: dealData?.buyerCommissionPercentage ? Number(dealData.buyerCommissionPercentage) : null,
        buyer_flat_fee: dealData?.buyerFlatFee ? Number(dealData.buyerFlatFee) : null,
        agreement_length_days: dealData?.agreementLength ? Number(dealData.agreementLength) : 180,
        transaction_type: 'ASSIGNMENT'
      };

      // CRITICAL: For draft flow, only pass draft_id (NOT deal_id) to avoid 404
      // deal_id should only be used when an actual Deal entity exists
      const res = await base44.functions.invoke('generateLegalAgreement', {
        draft_id: draftId || undefined,
        deal_id: draftId ? undefined : dealId,
        signer_mode: 'investor_only',
        exhibit_a: exhibit_a,
        investor_profile_id: profile?.id,
        property_address: dealData?.propertyAddress,
        city: dealData?.city,
        state: dealData?.state,
        zip: dealData?.zip,
        county: dealData?.county
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
      // CRITICAL: Always fetch latest agreement before signing to ensure we have the current one
      const latestRes = await base44.functions.invoke('getLegalAgreement', { 
        deal_id: dealId, 
        room_id: roomId || undefined 
      });
      
      const agreementToSign = latestRes?.data?.agreement || localAgreement;
      
      if (!agreementToSign?.id) {
        toast.error('No agreement to sign');
        setBusy(false);
        return;
      }

      console.log('[SimpleAgreementPanel] Signing agreement:', agreementToSign.id, 'investor_signed:', !!agreementToSign.investor_signed_at);

      const res = await base44.functions.invoke('docusignCreateSigningSession', {
        agreement_id: agreementToSign.id,
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
      console.log('[SimpleAgreementPanel] Room update received:', {
        requires_regenerate: event.data.requires_regenerate,
        agreement_status: event.data.agreement_status,
        current_legal_agreement_id: event.data.current_legal_agreement_id
      });
      setLocalRoom(prev => {
        // Update if ANY critical field changed
        if (prev?.requires_regenerate === event.data.requires_regenerate &&
            prev?.proposed_terms === event.data.proposed_terms &&
            prev?.agreement_status === event.data.agreement_status &&
            prev?.current_legal_agreement_id === event.data.current_legal_agreement_id) {
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

  // Force refresh room state periodically if agent is waiting
  React.useEffect(() => {
    if (!roomId || !isAgent || !requiresRegenerate) return;
    
    const pollInterval = setInterval(async () => {
      try {
        const rooms = await base44.entities.Room.filter({ id: roomId });
        if (rooms?.[0]) {
          console.log('[SimpleAgreementPanel] Polling room state:', {
            requires_regenerate: rooms[0].requires_regenerate,
            agreement_status: rooms[0].agreement_status
          });
          setLocalRoom(rooms[0]);
          
          // Also refresh agreement to get latest investor signature status
          const res = await base44.functions.invoke('getLegalAgreement', { 
            deal_id: dealId, 
            room_id: roomId 
          });
          if (res?.data?.agreement) {
            setLocalAgreement(res.data.agreement);
          }
        }
      } catch (e) {
        console.error('[SimpleAgreementPanel] Poll error:', e);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(pollInterval);
  }, [roomId, isAgent, requiresRegenerate, dealId]);

  // CRITICAL: Only trigger callback once after signing, not on every load
  const [hasTriggeredCallback, setHasTriggeredCallback] = useState(false);
  useEffect(() => {
    if (investorSigned && !agentSigned && onInvestorSigned && !hasTriggeredCallback) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('signed') === '1') {
        console.log('[SimpleAgreementPanel] Triggering onInvestorSigned callback');
        setHasTriggeredCallback(true);
        onInvestorSigned();
      }
    }
  }, [investorSigned, agentSigned, onInvestorSigned, hasTriggeredCallback]);

  // Refresh agreement AND room after signing redirect with exponential backoff retry
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('signed') === '1' && dealId) {
      let retryCount = 0;
      const maxRetries = 5;
      const initialDelay = 1000; // Start at 1 second

      const attemptRefresh = async () => {
        try {
          // Refresh agreement to get latest signature status
          const res = await base44.functions.invoke('getLegalAgreement', { 
            deal_id: dealId, 
            room_id: roomId || undefined 
          });

          if (res?.data?.agreement?.investor_signed_at) {
            // Agreement has signature - we're done
            console.log('[SimpleAgreementPanel] Signature confirmed after retry', retryCount);
            setLocalAgreement(res.data.agreement);

            if (roomId) {
              const roomRes = await base44.entities.Room.filter({ id: roomId });
              if (roomRes?.[0]) {
                setLocalRoom(roomRes[0]);
                if (isInvestor && res?.data?.agreement?.investor_signed_at && roomRes[0].requires_regenerate === true) {
                  await base44.entities.Room.update(roomId, { requires_regenerate: false });
                  setLocalRoom(prev => ({ ...prev, requires_regenerate: false }));
                }
              }
            }
            return true; // Success
          } else if (retryCount < maxRetries) {
            // No signature yet, retry with exponential backoff
            retryCount++;
            const delay = initialDelay * Math.pow(2, retryCount - 1);
            console.log(`[SimpleAgreementPanel] Signature not found yet, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
            setTimeout(attemptRefresh, delay);
          } else {
            console.warn('[SimpleAgreementPanel] Max retries reached, signature still not found');
          }
        } catch (e) {
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = initialDelay * Math.pow(2, retryCount - 1);
            console.warn(`[SimpleAgreementPanel] Refresh error, retrying in ${delay}ms:`, e.message);
            setTimeout(attemptRefresh, delay);
          } else {
            console.error('[SimpleAgreementPanel] Failed to refresh after max retries:', e);
          }
        }
      };

      attemptRefresh();
    }
  }, [dealId, roomId, isInvestor]);

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
                 {/* Priority 1: Show regenerate button ONLY if counter was accepted (requires_regenerate) and investor hasn't signed the NEW agreement */}
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
                                            // Otherwise, create signing session with retry
                                            toast.success('Agreement ready, redirecting to sign...');

                                            const agreementId = res.data.agreement?.id;
                                            if (!agreementId) {
                                              setDebugError('Agreement ID missing from regeneration response');
                                              toast.error('Agreement ID missing');
                                              setBusy(false);
                                              return;
                                            }

                                            console.log('[SimpleAgreementPanel] Creating signing session for agreement:', agreementId);

                                            // Longer delay to ensure DocuSign envelope is created
                                            await new Promise(r => setTimeout(r, 2000));

                                            // Retry logic for signing session
                                            let signRes = null;
                                            let attempts = 0;
                                            const maxAttempts = 3;

                                            while (attempts < maxAttempts && !signRes?.data?.signing_url) {
                                              attempts++;
                                              try {
                                                const baseUrl = window.location.href.split('&signed')[0].split('?')[0];
                                                signRes = await base44.functions.invoke('docusignCreateSigningSession', {
                                                  agreement_id: agreementId,
                                                  role: 'investor',
                                                  room_id: roomId,
                                                  redirect_url: `${baseUrl}?roomId=${roomId}&signed=1`
                                                });

                                                console.log(`[SimpleAgreementPanel] Signing session response (attempt ${attempts}):`, signRes.data);

                                                if (signRes.data?.signing_url) {
                                                  window.location.assign(signRes.data.signing_url);
                                                  return;
                                                }

                                                // If envelope not ready, wait and retry
                                                if (signRes.data?.error?.includes('envelope') || signRes.data?.error?.includes('missing')) {
                                                  if (attempts < maxAttempts) {
                                                    console.log('[SimpleAgreementPanel] Envelope not ready, retrying in 1.5s...');
                                                    await new Promise(r => setTimeout(r, 1500));
                                                  }
                                                } else {
                                                  // Other error, don't retry
                                                  break;
                                                }
                                              } catch (e) {
                                                console.error(`[SimpleAgreementPanel] Signing attempt ${attempts} error:`, e);
                                                if (attempts >= maxAttempts) {
                                                  const errorMsg = e?.response?.data?.error || e?.message || 'Failed to start signing';
                                                  setDebugError(errorMsg);
                                                  toast.error(errorMsg);
                                                  setBusy(false);
                                                  return;
                                                }
                                                // Wait and retry
                                                await new Promise(r => setTimeout(r, 1500));
                                              }
                                            }

                                            // Final fallback if no signing URL after retries
                                            if (!signRes?.data?.signing_url) {
                                              const errorMsg = signRes?.data?.error || 'Failed to get signing URL after multiple attempts';
                                              console.error('[SimpleAgreementPanel] No signing URL after retries:', signRes?.data);
                                              setDebugError(errorMsg);
                                              toast.error(errorMsg);
                                              setBusy(false);
                                            }
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

                                      {/* Priority 2: Show sign button ONLY if investor hasn't signed AND no regeneration needed AND agreement exists and is not superseded */}
                                      {!investorSigned && !canRegenerate && !requiresRegenerate && localAgreement && localAgreement.status !== 'superseded' && (
                                      <Button
                                      onClick={() => handleSign('investor')}
                                      disabled={busy}
                                      className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                                      >
                                      {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                      Sign Agreement
                                      </Button>
                                      )}

                                      {/* Priority 3: Investor already signed - show waiting message */}
                                      {investorSigned && !agentSigned && !requiresRegenerate && (
                                      <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                                      <p className="text-sm text-[#FAFAFA]">Waiting for agent to sign</p>
                                      </div>
                                      )}
               </div>
              )}

              {/* Agent Actions - Only show if not fully signed */}
              {isAgent && !fullySigned && localAgreement && (
                <div className="space-y-3">
                  {/* CRITICAL: Show sign/counter buttons when:
                      - signer_mode is 'agent_only' (agent-specific agreement), OR
                      - signer_mode is 'investor_only' AND investor has signed (base agreement - agent signs same envelope)
                      - AND agent hasn't signed yet */}
                  {((localAgreement.signer_mode === 'agent_only') || 
                    ((localAgreement.signer_mode === 'investor_only' || !localAgreement.signer_mode) && investorSigned)) && 
                   !agentSigned && !pendingCounters.some(c => c.status === 'pending') && localAgreement?.status !== 'superseded' && (
                    <>
                      <Button
                        onClick={() => handleSign('agent')}
                        disabled={busy}
                        className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      >
                        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Sign Agreement
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

                  {/* For 'both' mode - wait for investor to regenerate after counter */}
                  {localAgreement.signer_mode === 'both' && requiresRegenerate && !investorSigned && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to regenerate and sign with the new terms</p>
                    </div>
                  )}

                  {/* For 'both' mode - wait for investor to sign first */}
                  {localAgreement.signer_mode === 'both' && !investorSigned && !requiresRegenerate && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to sign first</p>
                    </div>
                  )}

                  {/* For 'investor_only' mode - wait for investor to sign first (then agent can sign same agreement) */}
                  {localAgreement.signer_mode === 'investor_only' && !investorSigned && !requiresRegenerate && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to sign first</p>
                    </div>
                  )}

                  {/* For 'both' mode - investor signed, agent can sign */}
                  {localAgreement.signer_mode === 'both' && investorSigned && !agentSigned && !pendingCounters.some(c => c.status === 'pending') && localAgreement?.status !== 'superseded' && (
                    <>
                      <Button
                        onClick={() => handleSign('agent')}
                        disabled={busy}
                        className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black"
                      >
                        {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Sign Agreement
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

                  {/* Show if agent has a pending counter waiting for investor review */}
                  {!agentSigned && pendingCounters.some(c => c.from_role === 'agent' && c.status === 'pending') && (
                    <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Waiting for investor to review your counter offer</p>
                    </div>
                  )}

                  {/* Show if investor has sent a counter and agent is waiting to respond */}
                  {!agentSigned && pendingCounters.some(c => c.from_role === 'investor' && c.status === 'pending') && (
                    <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">
                      <p className="text-sm text-[#FAFAFA]">Investor sent a counter offer - review or make your own counter</p>
                    </div>
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
                            onClick={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('[SimpleAgreementPanel] Accept button clicked for counter:', counter.id);

                              try {
                                console.log('[SimpleAgreementPanel] Invoking respondToCounterOffer with accept...');
                                const res = await base44.functions.invoke('respondToCounterOffer', {
                                  counter_offer_id: counter.id,
                                  action: 'accept'
                                });

                                console.log('[SimpleAgreementPanel] Response:', res);

                                if (res.data?.error) {
                                  console.error('[SimpleAgreementPanel] Backend error:', res.data.error);
                                  toast.error(res.data.error);
                                  return;
                                }

                                if (!res.data?.success) {
                                  console.error('[SimpleAgreementPanel] Response not successful:', res.data);
                                  toast.error('Failed to accept counter offer');
                                  return;
                                }

                                console.log('[SimpleAgreementPanel] Counter accepted successfully');
                                 toast.success('Counter accepted - Regenerate agreement to continue');

                                 // CRITICAL: Remove this counter AND refresh to get updated room state
                                 setPendingCounters(prev => prev.filter(c => c.id !== counter.id));
                                 if (setIncomingCounters) setIncomingCounters(prev => prev.filter(c => c.id !== counter.id));

                                 // CRITICAL: Immediately set requires_regenerate locally so button shows
                                 setLocalRoom(prev => ({ ...prev, requires_regenerate: true, agreement_status: 'draft' }));

                                 // Refresh room and agreement to get updated requires_regenerate flag
                                 setTimeout(async () => {
                                   try {
                                     const roomRes = await base44.entities.Room.filter({ id: roomId });
                                     if (roomRes?.[0]) {
                                       console.log('[SimpleAgreementPanel] Room after counter accept:', {
                                         requires_regenerate: roomRes[0].requires_regenerate,
                                         agreement_status: roomRes[0].agreement_status
                                       });
                                       setLocalRoom(roomRes[0]);
                                       if (onRoomUpdate) onRoomUpdate(roomRes[0]);
                                     }

                                     // Also refresh agreement to sync new terms
                                     const agRes = await base44.functions.invoke('getLegalAgreement', { 
                                       deal_id: dealId, 
                                       room_id: roomId 
                                     });
                                     if (agRes?.data?.agreement) {
                                       setLocalAgreement(agRes.data.agreement);
                                     }
                                   } catch (_) {}
                                 }, 500);

                                 if (onCounterReceived) onCounterReceived();
                              } catch (e) {
                                console.error('[SimpleAgreementPanel] Accept error:', e);
                                const errorMsg = e?.response?.data?.error || e?.data?.error || e?.message || 'Failed to accept counter';
                                console.error('[SimpleAgreementPanel] Error message:', errorMsg);
                                toast.error(errorMsg);
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
                               onClick={async (e) => {
                                 e.preventDefault();
                                 e.stopPropagation();
                                 console.log('[SimpleAgreementPanel] Agent accept button clicked for counter:', counter.id);

                                 try {
                                   console.log('[SimpleAgreementPanel] Invoking respondToCounterOffer with accept...');
                                   const res = await base44.functions.invoke('respondToCounterOffer', {
                                     counter_offer_id: counter.id,
                                     action: 'accept'
                                   });

                                   console.log('[SimpleAgreementPanel] Response:', res);

                                   if (res.data?.error) {
                                     console.error('[SimpleAgreementPanel] Backend error:', res.data.error);
                                     toast.error(res.data.error);
                                     return;
                                   }
                                   if (!res.data?.success) {
                                     console.error('[SimpleAgreementPanel] Response not successful:', res.data);
                                     toast.error('Counter acceptance failed');
                                     return;
                                   }

                                   console.log('[SimpleAgreementPanel] Counter accepted successfully');
                                   toast.success('Counter accepted - Waiting for investor to regenerate');

                                   setPendingCounters(prev => prev.filter(c => c.id !== counter.id));
                                   if (setIncomingCounters) setIncomingCounters(prev => prev.filter(c => c.id !== counter.id));

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
                                   const errMsg = e?.response?.data?.error || e?.data?.error || e?.message || 'Failed to accept counter';
                                   console.error('[SimpleAgreementPanel] Error message:', errMsg);
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