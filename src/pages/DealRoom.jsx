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

  // LOCKED TO ONE AGENT - Show normal room UI
  if (isLocked) {
    const lockedInvite = invites.find(i => i.agent_profile_id === deal.locked_agent_profile_id);
    const roomId = lockedInvite?.room_id || deal.locked_room_id;

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

  // MULTI-AGENT BOARD - Pre-lock state with Room-style UI
  if (showMultiAgentBoard) {
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
              Choose an agent to proceed
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
              Pending Agents
            </button>
            <button
              onClick={() => selectedInvite && setActiveTab('deal-board')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                !selectedInvite ? 'text-[#808080]/50 cursor-not-allowed' :
                activeTab === 'deal-board'
                  ? 'text-[#E3C567] border-b-2 border-[#E3C567]'
                  : 'text-[#808080] hover:text-[#FAFAFA]'
              }`}
              disabled={!selectedInvite}
            >
              Deal Board
            </button>
          </div>

          {activeTab === 'messages' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {invites.map((invite) => {
                const isSelected = selectedInvite?.id === invite.id;
                const agent = invite.agent;

                return (
                  <div
                    key={invite.id}
                    onClick={() => setSelectedInvite(invite)}
                    className={`bg-[#0D0D0D] border-2 rounded-2xl p-6 cursor-pointer transition-all ${
                      isSelected
                        ? 'border-[#E3C567] shadow-lg shadow-[#E3C567]/20'
                        : 'border-[#1F1F1F] hover:border-[#E3C567]/50'
                    }`}
                  >
                    {/* Agent Header */}
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center">
                        <User className="w-6 h-6 text-[#E3C567]" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-[#FAFAFA]">{agent.full_name}</h3>
                        <p className="text-xs text-[#808080]">{agent.brokerage || 'Agent'}</p>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#808080]">Rating</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 text-[#E3C567] fill-current" />
                          <span className="text-[#FAFAFA]">{agent.rating || 0}/5</span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-[#808080]">Deals Closed</span>
                        <span className="text-[#FAFAFA]">{agent.completed_deals || 0}</span>
                      </div>
                    </div>

                    {/* Agreement Status */}
                    <div className="mb-4">
                      <Badge className={
                        invite.agreement_status === 'fully_signed' ? 'bg-[#34D399]/20 text-[#34D399]' :
                        invite.agreement_status === 'investor_signed' ? 'bg-[#E3C567]/20 text-[#E3C567]' :
                        'bg-[#808080]/20 text-[#808080]'
                      }>
                        {invite.agreement_status === 'fully_signed' && <CheckCircle className="w-3 h-3 mr-1" />}
                        {invite.agreement_status === 'investor_signed' && <Clock className="w-3 h-3 mr-1" />}
                        {invite.agreement_status === 'fully_signed' ? 'Signed' :
                         invite.agreement_status === 'investor_signed' ? 'Pending Agent' :
                         'Pending'}
                      </Badge>
                    </div>

                    {/* Actions */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`${createPageUrl('AgentProfile')}?profileId=${agent.id}`);
                      }}
                      variant="outline"
                      size="sm"
                      className="w-full border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414] rounded-full"
                    >
                      View Profile
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'deal-board' && selectedInvite && (
            <div className="space-y-6">
              <PropertyDetailsCard deal={deal} />
              {selectedInvite.legal_agreement_id && (
                <SimpleAgreementPanel
                  dealId={dealId}
                  agreement={{ id: selectedInvite.legal_agreement_id }}
                  profile={profile}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Single agent (not locked yet) - auto-select and show deal board
  if (invites.length === 1) {
    const invite = invites[0];
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