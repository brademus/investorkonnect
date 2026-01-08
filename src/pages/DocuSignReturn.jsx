import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Loader2 } from 'lucide-react';

export default function DocuSignReturn() {
  const location = useLocation();
  const [message, setMessage] = useState('Processing DocuSign response...');
  const [error, setError] = useState(false);

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const event = queryParams.get('event');
    const token = queryParams.get('token');

    async function handleDocuSignReturn() {
      if (!token) {
        setError(true);
        setMessage('Missing signing token.');
        return;
      }

      try {
        // Call backend via direct fetch to pass query params correctly
        const url = `/api/functions/docusignHandleReturn?token=${token}&event=${event || 'signing_complete'}`;
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok || data.error) {
          setError(true);
          setMessage(`Error: ${data.error}`);
          setTimeout(() => {
            window.location.href = data.returnTo || '/Pipeline';
          }, 3000);
          return;
        }

        const status = data.status;
        const statusMessage = status === 'fully_signed' 
          ? 'Agreement fully signed! Deal unlocked.' 
          : status === 'investor_signed'
          ? 'You signed! Waiting for agent signature.'
          : status === 'agent_signed'
          ? 'You signed! Waiting for investor signature.'
          : 'Signing complete!';
        
        setMessage(statusMessage);
        
        // Add cache buster to force reload fresh data
        const returnTo = data.returnTo || '/Pipeline';
        const cacheBuster = returnTo.includes('?') ? '&signed=1&_t=' : '?signed=1&_t=';
        const finalUrl = `${returnTo}${cacheBuster}${Date.now()}`;
        
        console.log('[DocuSignReturn] Redirecting to:', finalUrl);
        
        setTimeout(() => {
          window.location.href = finalUrl;
        }, 1500);

      } catch (err) {
        console.error('Error handling DocuSign return:', err);
        setError(true);
        setMessage('An unexpected error occurred.');
        setTimeout(() => {
          window.location.href = '/Pipeline';
        }, 3000);
      }
    }

    handleDocuSignReturn();
  }, [location.search]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] text-[#FAFAFA]">
      <div className="text-center">
        {error ? (
          <p className="text-red-500 text-lg">{message}</p>
        ) : (
          <div className="flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-[#E3C567] mb-4" />
            <p className="text-lg">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}