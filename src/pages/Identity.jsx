import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Shield, ArrowLeft } from 'lucide-react';
import IdentityMismatchModal from '@/components/identity/IdentityMismatchModal';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function Identity() {
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mismatchOpen, setMismatchOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshed, setAutoRefreshed] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await base44.functions.invoke('getIdentityStatus');
    setIdentity(data.identity);
    setProfile(data.profile);
    setLoading(false);
    if (data.identity?.verificationStatus === 'VERIFIED' && data.identity?.nameMatchStatus === 'MISMATCH') {
      setMismatchOpen(true);
    }
  };

  useEffect(() => { load(); }, []);

  // If user returns from Stripe, poll once to ensure status updates (covers webhook delays)
  useEffect(() => {
    const hasStripeReturn = /identity|verification|return/i.test(window.location.href);
    if (!autoRefreshed && hasStripeReturn) {
      (async () => {
        setAutoRefreshed(true);
        await base44.functions.invoke('refreshIdentitySessionStatus');
        await load();
      })();
    }
  }, [autoRefreshed]);

  const startVerification = async () => {
    const { data } = await base44.functions.invoke('createIdentityVerificationSession');
    if (data?.url) window.location.assign(data.url);
  };

  const refreshStatus = async () => {
    setRefreshing(true);
    await base44.functions.invoke('refreshIdentitySessionStatus');
    await load();
    setRefreshing(false);
  };

  const handleUpdateProfile = async () => {
    await base44.functions.invoke('resolveIdentityMismatch', {
      verifiedFirstName: identity?.verifiedFirstName,
      verifiedLastName: identity?.verifiedLastName,
    });
    setMismatchOpen(false);
    await load();
  };

  const enteredName = profile?.full_name || '';
  const verifiedName = [identity?.verifiedFirstName, identity?.verifiedLastName].filter(Boolean).join(' ');

  if (loading) {
    return (
      <div className="max-w-xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Card className="ik-card p-0 overflow-hidden bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
          <CardHeader className="border-b border-[#1F1F1F] py-4">
            <CardTitle className="text-lg text-[#FAFAFA]">Verify Identity</CardTitle>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <Loader2 className="w-5 h-5 mx-auto animate-spin text-[#E3C567]" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-4">
        <Button asChild variant="outline" className="gap-2 rounded-full">
          <Link to={createPageUrl('Pipeline')}>
            <ArrowLeft className="w-4 h-4" /> Back to Pipeline
          </Link>
        </Button>
      </div>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="ik-card p-0 overflow-hidden bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA]">
          <CardHeader className="border-b border-[#1F1F1F] py-4">
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-[#E3C567]" />
              <CardTitle className="text-lg text-[#FAFAFA]">Verify Identity</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-3">
          {identity?.verificationStatus === 'NOT_STARTED' || identity?.verificationStatus === 'REQUIRES_INPUT' ? (
           <>
             <p className="text-sm text-[#808080]">Verify your identity so your legal name matches your contracts.</p>
             <Button className="bg-[#E3C567] hover:bg-[#EDD89F] text-black w-full rounded-full" onClick={startVerification}>
               {identity?.verificationStatus === 'NOT_STARTED' ? 'Start Verification' : 'Resume Verification'}
             </Button>
           </>
          ) : identity?.verificationStatus === 'PROCESSING' ? (
           <>
             <p className="text-sm text-[#808080]">Your verification is processing.</p>
             <Button variant="outline" className="w-full rounded-full" onClick={refreshStatus} disabled={refreshing}>
               {refreshing ? 'Refreshing…' : 'Refresh Status'}
             </Button>
           </>
          ) : identity?.verificationStatus === 'VERIFIED' ? (
           <>
             {identity?.nameMatchStatus === 'MATCH' ? (
               <div className="bg-[#10B981]/10 border border-[#10B981]/30 rounded-xl p-4 text-center">Identity verified and name matched.</div>
             ) : (
               <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-xl p-4 text-center">Verified, but name mismatch detected.</div>
             )}
             <div className="text-sm text-[#808080]">
               Entered: <span className="text-[#FAFAFA]">{enteredName || '—'}</span><br />
               Verified: <span className="text-[#FAFAFA]">{verifiedName || '—'}</span>
             </div>
             {identity?.nameMatchStatus === 'MISMATCH' && (
               <div className="flex gap-2">
                 <Button className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full" onClick={handleUpdateProfile}>Update Profile Name</Button>
                 <Button variant="outline" className="flex-1 rounded-full" onClick={startVerification}>Re-verify</Button>
               </div>
             )}
           </>
          ) : identity?.verificationStatus === 'CANCELED' ? (
           <>
             <p className="text-sm text-[#808080]">Verification was canceled.</p>
             <Button className="bg-[#E3C567] hover:bg-[#EDD89F] text-black w-full rounded-full" onClick={startVerification}>Start Again</Button>
           </>
          ) : (
           <>
             <p className="text-sm text-[#808080]">Verification failed. Please try again.</p>
             <Button className="bg-[#E3C567] hover:bg-[#EDD89F] text-black w-full rounded-full" onClick={startVerification}>Try Again</Button>
           </>
          )}
        </CardContent>
      </Card>
      </div>

      <IdentityMismatchModal
        open={mismatchOpen}
        onClose={() => setMismatchOpen(false)}
        enteredName={enteredName}
        verifiedName={verifiedName}
        onUpdateProfile={handleUpdateProfile}
        onReverify={startVerification}
      />
    </div>
  );
}