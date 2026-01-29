import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Star, CheckCircle, Clock, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/components/utils';

export default function PendingAgentsList({ invites, onSelectAgent, selectedInviteId }) {
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-6 text-center">
        <h2 className="text-2xl font-bold text-[#E3C567] mb-2">Select an Agent</h2>
        <p className="text-sm text-[#808080]">Choose an agent to view their deal board and agreement</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {invites.map((invite) => {
          const isSelected = selectedInviteId === invite.id;
          const agent = invite.agent;

          return (
            <div
              key={invite.id}
              onClick={() => onSelectAgent(invite)}
              className={`bg-[#0D0D0D] border-2 rounded-2xl p-5 cursor-pointer transition-all ${
                isSelected
                  ? 'border-[#E3C567] shadow-lg shadow-[#E3C567]/20'
                  : 'border-[#1F1F1F] hover:border-[#E3C567]/50'
              }`}
            >
              {/* Agent Header */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-[#E3C567]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-semibold text-[#FAFAFA] truncate">{agent.full_name}</h3>
                  <p className="text-xs text-[#808080] truncate">{agent.brokerage || 'Real Estate Agent'}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#808080]">Rating</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 text-[#E3C567] fill-current" />
                    <span className="text-[#FAFAFA]">{agent.rating || '4.8'}/5</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[#808080]">Deals Closed</span>
                  <span className="text-[#FAFAFA]">{agent.completed_deals || '12'}</span>
                </div>
              </div>

              {/* Agreement Status */}
              <div className="mb-4">
                <Badge className={
                  invite.agreement_status === 'fully_signed' ? 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/30' :
                  invite.agreement_status === 'investor_signed' ? 'bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30' :
                  'bg-[#808080]/20 text-[#808080] border-[#808080]/30'
                }>
                  {invite.agreement_status === 'fully_signed' && <CheckCircle className="w-3 h-3 mr-1" />}
                  {invite.agreement_status === 'investor_signed' && <Clock className="w-3 h-3 mr-1" />}
                  {invite.agreement_status === 'fully_signed' ? 'Fully Signed' :
                   invite.agreement_status === 'investor_signed' ? 'Pending Agent Signature' :
                   'Not Yet Signed'}
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
                className="w-full border-[#1F1F1F] text-[#FAFAFA] hover:bg-[#141414] hover:border-[#E3C567] rounded-full"
              >
                View Profile
              </Button>
            </div>
          );
        })}
      </div>

      {invites.length === 0 && (
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
          <Shield className="w-12 h-12 text-[#808080] mx-auto mb-4 opacity-50" />
          <p className="text-sm text-[#808080]">No pending agents for this deal</p>
        </div>
      )}
    </div>
  );
}