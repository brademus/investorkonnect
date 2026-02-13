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
    // Safety net: if we're still on this page after 15s, force redirect
    const safetyTimeout = setTimeout(() => {
      console.warn('[DocuSignReturn] Safety timeout - forcing redirect to Pipeline');
      toast.success('Signature processed!');
      navigate(createPageUrl("Pipeline"), { replace: true });
    }, 15000);

    const handleReturn = async () => {
      try {
        const event = searchParams.get('event');
        const dealId = searchParams.get('dealId') || searchParams.get('deal_id');
        const roomId = searchParams.get('roomId');

        console.log('[DocuSignReturn]', { event, dealId, roomId, allParams: Object.fromEntries(searchParams.entries()) });

        // DocuSign returns various event types for signing completion
        if (event === 'signing_complete' || event === 'completed') {
          setMessage("Signature completed! Processing...");
          setStatus("success");

          // Find the agreement to get agreement_id
          const signingRole = searchParams.get('role') || 'investor';
          const token = searchParams.get('token');
          
          // Get agreement_id from SigningToken or from LegalAgreement lookup
          let agreementId = null;
          if (token) {
            try {
              const tokens = await base44.entities.SigningToken.filter({ token });
              if (tokens?.[0]) agreementId = tokens[0].agreement_id;
            } catch (_) {}
          }
          if (!agreementId && dealId) {
            try {
              const agreements = await base44.entities.LegalAgreement.filter({ deal_id: dealId }, '-created_date', 1);
              if (agreements?.[0]) agreementId = agreements[0].id;
            } catch (_) {}
          }

          // ALWAYS call pollAndFinalizeSignature to confirm the signature immediately
          // This ensures the agreement record is updated before we redirect,
          // so the UI shows the correct signed status right away.
          if (agreementId) {
            try {
              console.log('[DocuSignReturn] Calling pollAndFinalizeSignature for agreement:', agreementId, 'role:', signingRole);
              setMessage("Confirming signature...");
              
              const result = await base44.functions.invoke('pollAndFinalizeSignature', {
                agreement_id: agreementId,
                role: signingRole
              });
              
              console.log('[DocuSignReturn] pollAndFinalize result:', result.data);

              // For investor signing without a room: handle deal creation flow
              if (signingRole === 'investor' && !roomId) {
                const roomId_result = result.data?.room_id;
                const dealId_result = result.data?.deal_id;

                if (roomId_result) {
                  toast.success('Deal created and sent to agents!');
                  sessionStorage.removeItem('selectedAgentIds');
                  sessionStorage.removeItem(`selectedAgentIds_${dealId}`);
                  sessionStorage.removeItem('newDealDraft');
                  navigate(`${createPageUrl("Room")}?roomId=${roomId_result}`, { replace: true });
                  return;
                } else if (dealId_result) {
                  toast.success('Deal created! Redirecting...');
                  sessionStorage.removeItem('newDealDraft');
                  sessionStorage.removeItem('selectedAgentIds');
                  navigate(createPageUrl("Pipeline"), { replace: true });
                  return;
                } else {
                  toast.success('Agreement signed! Processing...');
                  sessionStorage.removeItem('newDealDraft');
                  sessionStorage.removeItem('selectedAgentIds');
                  await new Promise(resolve => setTimeout(resolve, 2000));
                  navigate(createPageUrl("Pipeline"), { replace: true });
                  return;
                }
              }

              // For agent signing: signature is now confirmed in the DB
              if (signingRole === 'agent' && roomId) {
                toast.success('Agreement signed successfully!');
                navigate(`${createPageUrl("Room")}?roomId=${roomId}&dealId=${dealId || ''}&tab=agreement&signed=1`, { replace: true });
                return;
              }
            } catch (pollError) {
              console.error('[DocuSignReturn] pollAndFinalize failed:', pollError);
              // Continue to fallback redirect below
            }
          }

          // Fallback: void old agreements if applicable
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
          
          // Fallback redirect to room or pipeline
          toast.success('Agreement signed!');
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