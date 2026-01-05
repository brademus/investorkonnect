import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import LoadingAnimation from '@/components/LoadingAnimation';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export default function DocuSignReturn() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Processing signature...');
  
  useEffect(() => {
    handleReturn();
  }, []);
  
  const handleReturn = async () => {
    try {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid return - missing token');
        setTimeout(() => navigate('/'), 3000);
        return;
      }
      
      // Call backend to process return
      const { data } = await base44.functions.invoke('docusignHandleReturn', { token });
      
      if (data.error) {
        setStatus('error');
        setMessage(data.error);
        setTimeout(() => navigate('/'), 3000);
        return;
      }
      
      // Success - show brief message then redirect
      setStatus('success');
      setMessage(data.investorSigned && data.agentSigned 
        ? 'Agreement fully signed!' 
        : 'Signature recorded successfully!');
      
      // Redirect back to original page after 1.5 seconds
      setTimeout(() => {
        window.location.href = data.redirectTo;
      }, 1500);
      
    } catch (error) {
      console.error('Return handling error:', error);
      setStatus('error');
      setMessage('Failed to process signature return');
      setTimeout(() => navigate('/'), 3000);
    }
  };
  
  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-6">
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <LoadingAnimation className="w-20 h-20 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">Processing Your Signature</h2>
            <p className="text-sm text-[#808080]">{message}</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-20 h-20 mx-auto mb-4 bg-green-400/10 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-12 h-12 text-green-400" />
            </div>
            <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">Signature Complete</h2>
            <p className="text-sm text-[#808080]">{message}</p>
            <p className="text-xs text-[#666] mt-2">Returning to your deal...</p>
          </>
        )}
        
        {status === 'error' && (
          <>
            <div className="w-20 h-20 mx-auto mb-4 bg-red-400/10 rounded-full flex items-center justify-center">
              <AlertCircle className="w-12 h-12 text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-[#FAFAFA] mb-2">Error</h2>
            <p className="text-sm text-[#808080]">{message}</p>
            <p className="text-xs text-[#666] mt-2">Redirecting to home...</p>
          </>
        )}
      </div>
    </div>
  );
}