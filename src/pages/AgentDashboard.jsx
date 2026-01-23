import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { inboxList } from "@/components/functions";
import { AuthGuard } from "@/components/AuthGuard";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, Loader2, TrendingUp, FileText, 
  Shield, CheckCircle, Clock, AlertCircle 
} from "lucide-react";
import { toast } from "sonner";

function AgentDashboardContent() {
  const navigate = useNavigate();
  const { loading: profileLoading, profile } = useCurrentProfile();
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState([]);
  const [activeDeals, setActiveDeals] = useState([]);

  useEffect(() => {
    if (!profileLoading && profile) {
      loadDashboard();
    }
  }, [profileLoading, profile]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      
      // Use inboxList to get leads (pending intros)
      const inboxResponse = await inboxList();
      const inbox = inboxResponse.data || [];
      
      // Separate into leads (pending) and active deals (accepted/active rooms)
      const pendingLeads = inbox.filter(item => 
        item.status === 'pending' || item.intro?.status === 'pending'
      );
      
      const activeItems = inbox.filter(item => 
        item.status === 'accepted' || item.room || item.intro?.status === 'accepted'
      );
      
      setLeads(pendingLeads);
      setActiveDeals(activeItems);
      setLoading(false);
      
    } catch (error) {
      console.error('Load dashboard error:', error);
      toast.error("Failed to load dashboard");
      setLoading(false);
    }
  };

  const handleRespondToLead = async (item, accept) => {
    try {
      await base44.functions.invoke('introRespond', {
        introId: item.intro?.id || item.id,
        accept
      });
      
      toast.success(accept ? "Lead accepted!" : "Lead declined");
      loadDashboard(); // Reload
      
      // If accepted, navigate to the room
      if (accept && item.roomId) {
        navigate(createPageUrl(`Room/${item.roomId}`));
      }
      
    } catch (error) {
      console.error('Respond error:', error);
      toast.error("Failed to respond");
    }
  };

  const handleOpenRoom = (roomId) => {
    navigate(createPageUrl(`Room/${roomId}`));
  };

  if (profileLoading || loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Agent Dashboard</h1>
          <p className="text-slate-600">Manage your leads and active deals</p>
        </div>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{leads.length}</span>
            </div>
            <h3 className="font-semibold text-slate-900">New Leads</h3>
            <p className="text-sm text-slate-600">Awaiting your response</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">{activeDeals.length}</span>
            </div>
            <h3 className="font-semibold text-slate-900">Active Deals</h3>
            <p className="text-sm text-slate-600">In progress</p>
          </div>
          
          <div className="bg-white rounded-xl p-6 border border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <span className="text-3xl font-bold text-slate-900">
                {profile?.agent?.verification_status === 'verified' ? '✓' : '•'}
              </span>
            </div>
            <h3 className="font-semibold text-slate-900">Verification</h3>
            <p className="text-sm text-slate-600">
              {profile?.agent?.verification_status === 'verified' ? 'Verified' : 'Pending'}
            </p>
          </div>
        </div>

        {/* New Leads */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-orange-600" />
            New Leads
          </h2>
          
          {leads.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No new leads at the moment</p>
            </div>
          ) : (
            <div className="space-y-4">
              {leads.map((lead) => (
                <div key={lead.id} className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-6 h-6 text-blue-600" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900">
                            {lead.investor?.full_name || 'New Investor'}
                          </h3>
                          <p className="text-sm text-slate-600">
                            {lead.investor?.company || 'Interested investor'}
                          </p>
                        </div>
                        <Badge variant="outline" className="ml-auto">
                          New
                        </Badge>
                      </div>
                      
                      {lead.intro?.message && (
                        <p className="text-slate-700 mb-3 pl-15">{lead.intro.message}</p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 pl-15">
                        {lead.investor?.markets?.map(market => (
                          <Badge key={market} variant="secondary" className="text-xs">
                            {market}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-4 pl-15">
                    <Button
                      onClick={() => handleRespondToLead(lead, true)}
                      className="bg-emerald-600 hover:bg-emerald-700"
                    >
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleRespondToLead(lead, false)}
                      variant="outline"
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Deals */}
        <div>
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Active Deals
          </h2>
          
          {activeDeals.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center border border-slate-200">
              <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No active deals yet</p>
              <p className="text-sm text-slate-500 mt-1">Accept leads to start working on deals</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {activeDeals.map((deal) => (
                <div 
                  key={deal.id}
                  className="bg-white rounded-xl p-6 border border-slate-200 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => deal.roomId && handleOpenRoom(deal.roomId)}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-900">
                        {deal.investor?.full_name || 'Active Deal'}
                      </h3>
                      <p className="text-sm text-slate-600">
                        {deal.investor?.company || 'Investor deal'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    {deal.room?.ndaSigned ? (
                      <Badge className="bg-emerald-100 text-emerald-800 text-xs">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        NDA Signed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        NDA Pending
                      </Badge>
                    )}
                    
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                  
                  {deal.investor?.markets && (
                    <div className="flex flex-wrap gap-1">
                      {deal.investor.markets.slice(0, 3).map(market => (
                        <Badge key={market} variant="outline" className="text-xs">
                          {market}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  return (
    <AuthGuard 
      requireAuth={true}
      requireOnboarding={true}
      requireRole="agent"
    >
      <AgentDashboardContent />
    </AuthGuard>
  );
}