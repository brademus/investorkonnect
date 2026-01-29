import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useCurrentProfile } from '@/components/useCurrentProfile';
import { createPageUrl } from '@/components/utils';
import LoadingAnimation from '@/components/LoadingAnimation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Star, FileText, CheckCircle, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';
import SimpleAgreementPanel from '@/components/SimpleAgreementPanel';
import PropertyDetailsCard from '@/components/PropertyDetailsCard';
import SimpleMessageBoard from '@/components/chat/SimpleMessageBoard';

/**
 * DEAL-CENTRIC INVESTOR VIEW
 * - Shows multi-agent board when multiple agents invited (pre-lock)
 * - Shows normal room UI when deal is locked to one agent
 */
export default function DealRoom() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const dealId = params.get('dealId');
  const { profile, loading: loadingProfile } = useCurrentProfile();

  const [deal, setDeal] = useState(null);
  const [invites, setInvites] = useState([]);
  const [selectedInvite, setSelectedInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('messages'); // messages | deal-board

  // Load deal and invites
  useEffect(() => {
    if (!dealId || loadingProfile) return;

    const loadData = async () => {
      try {
        // Load deal
        const dealRes = await base44.functions.invoke('getDealDetailsForUser', { dealId });
        const loadedDeal = dealRes?.data?.deal || dealRes?.data;
        setDeal(loadedDeal);

        // Check if investor has signed the agreement
        try {
          const { data } = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
          const ag = data?.agreement;
          const investorSigned = !!ag?.investor_signed_at;
          
          if (!investorSigned) {
            // Investor hasn't signed yet - redirect to MyAgreement
            navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}`);
            return;
          }
        } catch (e) {
          // No agreement exists - redirect to MyAgreement to generate + sign
          navigate(`${createPageUrl("MyAgreement")}?dealId=${dealId}`);
          return;
        }

        // Load invites (only after investor has signed)
        const invitesRes = await base44.functions.invoke('getDealInvitesForInvestor', { deal_id: dealId });
        if (invitesRes.data?.ok) {
          setInvites(invitesRes.data.invites || []);
        }
      } catch (e) {
        console.error('Failed to load deal/invites:', e);
        toast.error('Failed to load deal');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [dealId, loadingProfile, navigate]);

  // Real-time updates for deal
  useEffect(() => {
    if (!dealId) return;

    const unsubscribe = base44.entities.Deal.subscribe((event) => {
      if (event.id === dealId) {
        setDeal(event.data);
      }
    });

    return unsubscribe;
  }, [dealId]);

  const isLocked = !!deal?.locked_agent_profile_id;
  const showMultiAgentBoard = !isLocked && invites.length > 1;

  if (loading || loadingProfile) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <LoadingAnimation className="w-48 h-48" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <p className="text-[#808080] mb-4">Deal not found</p>
          <Button onClick={() => navigate(createPageUrl('Pipeline'))}>
            Go to Pipeline
          </Button>
        </div>
      </div>
    );
  }

  // LOCKED TO ONE AGENT - Navigate to Room page
  if (isLocked) {
    const lockedInvite = invites.find(i => i.agent_profile_id === deal.locked_agent_profile_id);
    const roomId = lockedInvite?.room_id || deal.locked_room_id;

    if (roomId) {
      navigate(`${createPageUrl('Room')}?roomId=${roomId}`, { replace: true });
      return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <LoadingAnimation className="w-48 h-48" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-transparent px-6 py-10">
        <div className="max-w-6xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl('Pipeline'))}
            className="text-[#808080] hover:text-[#E3C567] text-sm mb-6"
          >
            ← Back to Pipeline
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#E3C567]">{deal.title}</h1>
            <p className="text-sm text-[#808080]">
              Connected with {lockedInvite?.agent?.full_name || 'Agent'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-[#1F1F1F]">
            <button
              onClick={() => setActiveTab('messages')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'messages'
                  ? 'text-[#E3C567] border-b-2 border-[#E3C567]'
                  : 'text-[#808080] hover:text-[#FAFAFA]'
              }`}
            >
              Messages
            </button>
            <button
              onClick={() => setActiveTab('deal-board')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'deal-board'
                  ? 'text-[#E3C567] border-b-2 border-[#E3C567]'
                  : 'text-[#808080] hover:text-[#FAFAFA]'
              }`}
            >
              Deal Board
            </button>
          </div>

          {activeTab === 'messages' && roomId && (
            <SimpleMessageBoard roomId={roomId} profile={profile} isChatEnabled={true} />
          )}

          {activeTab === 'deal-board' && (
            <div className="space-y-6">
              <PropertyDetailsCard deal={deal} />
              {lockedInvite?.legal_agreement_id && (
                <SimpleAgreementPanel
                  dealId={dealId}
                  agreement={{ id: lockedInvite.legal_agreement_id }}
                  profile={profile}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // MULTI-AGENT BOARD - Navigate to Room page with first invite's room
  if (showMultiAgentBoard) {
    const firstInvite = invites[0];
    const roomId = firstInvite?.room_id;

    if (roomId) {
      navigate(`${createPageUrl('Room')}?roomId=${roomId}`, { replace: true });
      return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <LoadingAnimation className="w-48 h-48" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-[#808080]">Loading rooms...</p>
      </div>
    );
  }

  // Single agent (not locked yet) - Navigate to Room page
  if (invites.length === 1) {
    const invite = invites[0];
    const roomId = invite?.room_id;

    if (roomId) {
      navigate(`${createPageUrl('Room')}?roomId=${roomId}`, { replace: true });
      return (
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <LoadingAnimation className="w-48 h-48" />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-transparent px-6 py-10">
        <div className="max-w-4xl mx-auto">
          <button
            onClick={() => navigate(createPageUrl('Pipeline'))}
            className="text-[#808080] hover:text-[#E3C567] text-sm mb-6"
          >
            ← Back to Pipeline
          </button>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-[#E3C567]">{deal.title}</h1>
            <p className="text-sm text-[#808080]">
              Waiting for {invite.agent?.full_name} to sign
            </p>
          </div>

          <div className="space-y-6">
            <PropertyDetailsCard deal={deal} />
            {invite.legal_agreement_id && (
              <SimpleAgreementPanel
                dealId={dealId}
                agreement={{ id: invite.legal_agreement_id }}
                profile={profile}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center">
      <p className="text-[#808080]">No invites found</p>
    </div>
  );
}