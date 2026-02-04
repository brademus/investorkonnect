import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function DocuSignReturn() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing signature...');

  useEffect(() => {
    const event = params.get('event');
    const draftId = params.get('draft_id');
    const dealId = params.get('deal_id');
    const roomId = params.get('room_id');
    const role = params.get('role');

    (async () => {
      try {
        // Handle signature events
        if (event === 'signing_complete') {
          // Investor signed
          if (role === 'investor' && draftId) {
            setMessage('Converting draft to deal...');
            
            const res = await base44.functions.invoke('convertDraftToDeal', {
              draft_id: draftId
            });

            if (res.status !== 200 || res.data?.error) {
              setStatus('error');
              setMessage(res.data?.error || 'Failed to convert draft to deal');
              console.error('[DocuSignReturn] convertDraftToDeal error:', res);
              return;
            }

            setStatus('success');
            setMessage('Deal created! Agents have been notified.');
            
            setTimeout(() => {
              navigate(createPageUrl('Pipeline'), { replace: true });
            }, 2000);
            return;
          }

          // Agent signed
          if (role === 'agent' && dealId && roomId) {
            setMessage('Processing your signature...');
            
            // Get agreement
            const agreements = await base44.entities.LegalAgreement.filter({
              deal_id: dealId,
              room_id: roomId
            });
            const agreement = agreements[0];

            if (agreement?.agent_signed_at) {
              // Agent has signed - check if they won
              const res = await base44.functions.invoke('agentSignAndWinDeal', {
                deal_id: dealId,
                room_id: roomId,
                agreement_id: agreement.id
              });

              if (res.data?.locked) {
                setStatus('error');
                setMessage('This deal has been locked to another agent');
                setTimeout(() => {
                  navigate(createPageUrl('Pipeline'), { replace: true });
                }, 3000);
                return;
              }

              if (res.data?.error) {
                setStatus('error');
                setMessage(res.data.error);
                return;
              }

              setStatus('success');
              setMessage('You won the deal! Redirecting...');
              
              setTimeout(() => {
                navigate(`${createPageUrl('Room')}?roomId=${roomId}`, { replace: true });
              }, 2000);
              return;
            }
          }
        }

        // Handle cancellation
        if (event === 'cancel' || event === 'decline') {
          setStatus('cancelled');
          setMessage('Signing cancelled');
          setTimeout(() => {
            if (roomId) {
              navigate(`${createPageUrl('Room')}?roomId=${roomId}`, { replace: true });
            } else {
              navigate(createPageUrl('Pipeline'), { replace: true });
            }
          }, 2000);
          return;
        }

        // Default fallback
        setStatus('error');
        setMessage('Unknown signature event');
      } catch (e) {
        console.error('[DocuSignReturn] Error:', e);
        setStatus('error');
        setMessage(e.message || 'Failed to process signature');
      }
    })();
  }, [params, navigate]);

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {status === 'processing' && (
          <>
            <LoadingAnimation className="w-48 h-48 mx-auto mb-4" />
            <p className="text-[#FAFAFA]">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-24 h-24 text-[#10B981] mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg font-semibold">{message}</p>
          </>
        )}

        {status === 'cancelled' && (
          <>
            <XCircle className="w-24 h-24 text-[#808080] mx-auto mb-4" />
            <p className="text-[#FAFAFA] text-lg">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-24 h-24 text-red-400 mx-auto mb-4" />
            <p className="text-red-400 text-lg font-semibold">{message}</p>
          </>
        )}
      </div>
    </div>
  );
}