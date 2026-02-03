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

          // Sync agreement status from DocuSign
          try {
            if (dealId) {
              await base44.functions.invoke('docusignSyncEnvelope', { deal_id: dealId });
            }
          } catch (e) {
            console.log('[DocuSignReturn] Sync optional');
          }

          // Investor signing: wait for automation to create deal, then verify room exists
           if (dealId && !roomId) {
             try {
               console.log('[DocuSignReturn] Investor signature detected - waiting for deal creation automation');

               // Give the automation time to create the Deal and invites
               // (createDealOnInvestorSignature runs on LegalAgreement update)
               let attempts = 0;
               const maxAttempts = 12; // ~6 seconds with 500ms intervals
               let rooms = [];

               while (attempts < maxAttempts && rooms.length === 0) {
                 await new Promise(resolve => setTimeout(resolve, 500));
                 try {
                   rooms = await base44.entities.Room.filter({ deal_id: dealId });
                 } catch (e) {
                   // Deal might not be queryable yet
                 }
                 attempts++;
               }

               if (rooms?.length > 0) {
                 console.log('[DocuSignReturn] ✓ Room found after automation, navigating to room');
                 toast.success('Deal created and sent to agents!');
                 sessionStorage.removeItem('selectedAgentIds');
                 sessionStorage.removeItem(`selectedAgentIds_${dealId}`);

                 // Navigate to first room
                 navigate(`${createPageUrl("Room")}?roomId=${rooms[0].id}`, { replace: true });
                 return;
               } else {
                 throw new Error('Room was not created by automation');
               }
             } catch (inviteError) {
               console.error('[DocuSignReturn] Deal creation or room lookup failed:', inviteError);
               toast.error('Failed to create deal: ' + inviteError.message);
               throw inviteError;
             }
           }

          // Agent signing regenerated: void old agreement in this room only
          if (roomId && dealId) {
            try {
              const latest = await base44.entities.LegalAgreement.filter({ 
                deal_id: dealId,
                room_id: roomId,
                status: 'fully_signed'
              }, '-created_date', 1);
              
              if (latest?.length > 0) {
                await base44.functions.invoke('voidOldAgreementForRoom', {
                  room_id: roomId,
                  new_agreement_id: latest[0].id
                }).catch(() => {});
              }
            } catch (e) {
              console.log('[DocuSignReturn] Void skipped');
            }
          }
          
          // Redirect to room or pipeline
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement&signed=1`, { replace: true });
          } else if (dealId) {
            navigate(createPageUrl("Pipeline"), { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
        } else if (event === 'decline' || event === 'cancel') {
          setMessage("Signature cancelled");
          setStatus("cancelled");
          toast.info("Signing cancelled");

          await new Promise(resolve => setTimeout(resolve, 1500));
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement`, { replace: true });
          } else if (dealId) {
            navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}`, { replace: true });
          } else {
            navigate(createPageUrl("Pipeline"), { replace: true });
          }
        } else {
          setMessage("Redirecting...");
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (roomId) {
            navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement`, { replace: true });
          } else if (dealId) {
            navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}`, { replace: true });
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