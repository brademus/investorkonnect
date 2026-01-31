import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import LoadingAnimation from "@/components/LoadingAnimation";
import { CheckCircle, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export default function DocuSignReturn() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("processing");
  const [message, setMessage] = useState("Processing your signature...");

  useEffect(() => {
    const handleReturn = async () => {
      try {
        const event = searchParams.get('event');
        const dealId = searchParams.get('dealId') || searchParams.get('deal_id');
        const roomId = searchParams.get('roomId');

        console.log('[DocuSignReturn]', { event, dealId, roomId });

        if (event === 'signing_complete') {
          setMessage("Signature completed! Redirecting...");
          setStatus("success");

          // If investor just signed (no roomId means base agreement), trigger invite creation
          if (dealId && !roomId) {
            try {
              console.log('[DocuSignReturn] Investor signed base agreement, syncing and creating invites for deal:', dealId);
              
              // CRITICAL: Sync DocuSign envelope first to ensure investor_signed_at is set
              await base44.functions.invoke('docusignSyncEnvelope', { deal_id: dealId });
              console.log('[DocuSignReturn] DocuSign envelope synced');
              
              // Now create invites for all selected agents
              const res = await base44.functions.invoke('createInvitesAfterInvestorSign', { 
                deal_id: dealId
              });
              
              console.log('[DocuSignReturn] Invite creation response:', res.data);
              
              if (res.data?.ok && res.data.invite_ids?.length > 0) {
                toast.success(`Deal sent to ${res.data.invite_ids.length} agent(s)!`);
                // Clear session storage
                sessionStorage.removeItem('selectedAgentIds');
                sessionStorage.removeItem(`selectedAgentIds_${dealId}`);
                sessionStorage.removeItem('pendingDealId');
                
                // Wait for rooms to be created, then redirect to first one
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Fetch the created rooms
                const roomsForDeal = await base44.entities.Room.filter({ deal_id: dealId });
                if (roomsForDeal?.length > 0) {
                  console.log('[DocuSignReturn] Redirecting to created room:', roomsForDeal[0].id);
                  navigate(`${createPageUrl("Room")}?roomId=${roomsForDeal[0].id}`, { replace: true });
                  return;
                }
              } else {
                console.error('[DocuSignReturn] Invite creation failed:', res.data);
                toast.error(res.data?.error || 'Failed to send deal to agents');
              }
            } catch (e) {
              console.error('[DocuSignReturn] Exception creating invites:', e);
              toast.error(e?.response?.data?.error || e?.message || 'Failed to send deal to agents');
            }
          }

          // Wait a moment then redirect
          await new Promise(resolve => setTimeout(resolve, 1500));

          // Regenerated agreement: investor signed, now only agent signature will void old agreement
          // Other agents can still sign the old agreement until this specific agent signs new one
          
          // ALWAYS redirect to Room if available
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement&signed=1&refresh=1`, { replace: true });
          } else if (dealId) {
            // Fallback to Pipeline if no rooms created
            navigate(createPageUrl("Pipeline"), { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
        } else if (event === 'decline' || event === 'cancel') {
          setMessage("Signature cancelled");
          setStatus("cancelled");
          toast.info("Signing cancelled");

          await new Promise(resolve => setTimeout(resolve, 1500));

          // Return to same deal context on cancel (no signed flag)
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement`, { replace: true });
          } else if (dealId) {
            navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}&tab=agreement`, { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
        } else {
          // Unknown event - redirect back to deal context
          setMessage("Redirecting...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement`, { replace: true });
          } else if (dealId) {
            navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}&tab=agreement`, { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
        }

      } catch (error) {
        console.error('[DocuSignReturn] Error:', error);
        setStatus("error");
        setMessage("Something went wrong");
        toast.error("Failed to process signature");
        
        setTimeout(() => {
          navigate(createPageUrl("Pipeline"));
        }, 2000);
      }
    };

    handleReturn();
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