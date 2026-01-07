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
        const response = await base44.functions.invoke('docusignHandleReturn', {
          token,
          event
        });

        if (response.data.error) {
          setError(true);
          setMessage(`Error: ${response.data.error}`);
          setTimeout(() => {
            window.location.href = response.data.returnTo || '/';
          }, 3000);
          return;
        }

        setMessage(response.data.message || 'Signing complete!');
        if (response.data.returnTo) {
          setTimeout(() => {
            window.location.href = response.data.returnTo;
          }, 1000);
        } else {
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }

      } catch (err) {
        console.error('Error handling DocuSign return:', err);
        setError(true);
        setMessage('An unexpected error occurred.');
        setTimeout(() => {
          window.location.href = '/';
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