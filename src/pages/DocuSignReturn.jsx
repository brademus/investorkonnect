import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import LoadingAnimation from "@/components/LoadingAnimation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function DocuSignReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your signature...");

  useEffect(() => {
    let redirected = false;
    const doRedirect = (url, msg) => {
      if (redirected) return;
      redirected = true;
      clearTimeout(safetyTimeout);
      // Immediately invalidate queries to clear any stale data
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['pipelineDeals'] });
      toast.success(msg || 'Signature processed!');
      // Small delay to ensure query cache is cleared before navigation
      setTimeout(() => {
        navigate(url, { replace: true });
      }, 100);
    };

    // Safety net: if we're still on this page after 12s, force redirect
    const safetyTimeout = setTimeout(() => {
      console.warn('[DocuSignReturn] Safety timeout - forcing redirect to Pipeline');
      doRedirect(createPageUrl("Pipeline"), 'Signature processed!');
    }, 12000);

    const handleReturn = async () => {
      const event = searchParams.get('event');
      const dealId = searchParams.get('dealId') || searchParams.get('deal_id');
      const roomId = searchParams.get('roomId');
      const signingRole = searchParams.get('role') || 'investor';
      const token = searchParams.get('token');

      console.log('[DocuSignReturn]', { event, dealId, roomId, signingRole, allParams: Object.fromEntries(searchParams.entries()) });

      // Handle cancel/decline quickly
      if (event === 'decline' || event === 'cancel') {
        setMessage("Signature cancelled");
        setStatus("cancelled");
        toast.info("Signing cancelled");
        await new Promise(r => setTimeout(r, 1000));
        if (roomId) {
          doRedirect(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}`);
        } else {
          doRedirect(dealId ? `${createPageUrl("MyAgreement")}?dealId=${dealId}` : createPageUrl("Pipeline"));
        }
        return;
      }

      // For non-signing_complete events, redirect immediately
      if (event !== 'signing_complete' && event !== 'completed') {
        setMessage("Redirecting...");
        await new Promise(r => setTimeout(r, 500));
        if (roomId) {
          doRedirect(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}`);
        } else {
          doRedirect(dealId ? `${createPageUrl("MyAgreement")}?dealId=${dealId}` : createPageUrl("Pipeline"));
        }
        return;
      }

      // === Signing complete flow ===
      setMessage("Signature completed! Processing...");
      setStatus("success");

      // Clean up session storage immediately
      sessionStorage.removeItem('selectedAgentIds');
      sessionStorage.removeItem('newDealDraft');
      if (dealId) sessionStorage.removeItem(`selectedAgentIds_${dealId}`);

      // Find agreement_id
      let agreementId = null;
      if (token) {
        const tokens = await base44.entities.SigningToken.filter({ token }).catch(() => []);
        if (tokens?.[0]) agreementId = tokens[0].agreement_id;
      }
      if (!agreementId && dealId) {
        const agreements = await base44.entities.LegalAgreement.filter({ deal_id: dealId }, '-created_date', 1).catch(() => []);
        if (agreements?.[0]) agreementId = agreements[0].id;
      }

      // Call pollAndFinalizeSignature with a timeout so we don't wait forever
      if (agreementId) {
        try {
          console.log('[DocuSignReturn] Calling pollAndFinalizeSignature:', agreementId, signingRole);
          setMessage("Confirming signature...");

          const pollPromise = base44.functions.invoke('pollAndFinalizeSignature', {
            agreement_id: agreementId,
            role: signingRole
          });

          // Race the poll against a 8s timeout
          const result = await Promise.race([
            pollPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error('poll_timeout')), 8000))
          ]);

          console.log('[DocuSignReturn] pollAndFinalize result:', result.data);

          // Investor flow for NEW deals (no roomId yet): redirect to room or pipeline
          if (signingRole === 'investor' && !roomId) {
            const roomIdResult = result.data?.room_id;
            const dealIdResult = result.data?.deal_id;
            if (roomIdResult) {
              doRedirect(`${createPageUrl("Room")}?roomId=${roomIdResult}`, 'Deal created and sent to agents!');
            } else {
              doRedirect(createPageUrl("Pipeline"), dealIdResult ? 'Deal created!' : 'Agreement signed!');
            }
            return;
          }

          // Investor flow for EXISTING deals (has roomId — e.g. regenerate after counter):
          if (signingRole === 'investor' && roomId) {
            doRedirect(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}`, 'Agreement signed!');
            return;
          }

          // Agent flow: go straight to deal board with signed=1 flag for instant refresh
          if (signingRole === 'agent' && roomId) {
            doRedirect(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&signed=1`, 'Agreement signed successfully!');
            return;
          }
        } catch (pollError) {
          console.warn('[DocuSignReturn] pollAndFinalize failed or timed out:', pollError?.message);
          // Fall through to fallback redirect
        }
      }

      // Fallback redirect — always go to deal board if we have roomId
      if (roomId) {
        doRedirect(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}`, 'Agreement signed!');
      } else {
        doRedirect(createPageUrl("Pipeline"), 'Agreement signed!');
      }
    };

    handleReturn().catch(error => {
      console.error('[DocuSignReturn] Unhandled error:', error);
      doRedirect(createPageUrl("Pipeline"), 'Redirecting...');
    });

    return () => clearTimeout(safetyTimeout);
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {status === "processing" && (
          <>
            <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
            <p className="text-sm text-[#808080]">{message}</p>
          </>
        )}
        
        {status === "success" && (
          <>
            <div className="w-20 h-20 bg-[#10B981]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-[#10B981]" />
            </div>
            <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Signature Complete!</h2>
            <p className="text-sm text-[#808080]">{message}</p>
          </>
        )}

        {status === "cancelled" && (
          <>
            <div className="w-20 h-20 bg-[#808080]/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-[#808080]" />
            </div>
            <h2 className="text-2xl font-bold text-[#FAFAFA] mb-2">Signature Cancelled</h2>
            <p className="text-sm text-[#808080]">{message}</p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-12 h-12 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-red-500 mb-2">Error</h2>
            <p className="text-sm text-[#808080]">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}