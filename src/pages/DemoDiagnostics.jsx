import React, { useState } from "react";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { matchAgentsForInvestor } from "@/components/functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

export default function DemoDiagnostics() {
  const { user, profile, loading: profileLoading } = useCurrentProfile();
  const [results, setResults] = useState([]);
  const [loadingOp, setLoadingOp] = useState(null);

  const addResult = (operation, status, data, error = null) => {
    setResults(prev => [{
      timestamp: new Date().toLocaleTimeString(),
      operation,
      status,
      data,
      error
    }, ...prev]);
  };

  const testPingBackend = async () => {
    setLoadingOp('ping');
    try {
      const response = await base44.functions.invoke('listMyRoomsEnriched');
      const rooms = response?.data?.rooms || [];
      addResult('Ping Backend (listMyRoomsEnriched)', 'success', {
        roomCount: rooms.length,
        rooms: rooms.map(r => ({ id: r.id, deal_id: r.deal_id }))
      });
    } catch (error) {
      addResult('Ping Backend', 'error', null, error.message);
    } finally {
      setLoadingOp(null);
    }
  };

  const testLoadMyDeals = async () => {
    setLoadingOp('deals');
    try {
      const deals = await base44.entities.Deal.filter({ investor_id: profile.id });
      addResult('Load My Deals', 'success', {
        dealCount: deals.length,
        deals: deals.map(d => ({
          id: d.id,
          title: d.title,
          stage: d.pipeline_stage,
          agent_id: d.agent_id
        }))
      });
    } catch (error) {
      addResult('Load My Deals', 'error', null, error.message);
    } finally {
      setLoadingOp(null);
    }
  };

  const testCreateDeal = async () => {
    setLoadingOp('create-deal');
    try {
      const newDeal = await base44.entities.Deal.create({
        title: `Test Deal ${Date.now()}`,
        investor_id: profile.id,
        pipeline_stage: 'new_deal_under_contract',
        property_address: '123 Test St',
        city: 'Phoenix',
        state: 'AZ',
        county: 'Maricopa',
        purchase_price: 250000
      });
      addResult('Create Test Deal', 'success', {
        dealId: newDeal.id,
        title: newDeal.title,
        stage: newDeal.pipeline_stage
      });
    } catch (error) {
      addResult('Create Test Deal', 'error', null, error.message);
    } finally {
      setLoadingOp(null);
    }
  };

  const testCreateRoom = async () => {
    setLoadingOp('create-room');
    try {
      // Get first deal and agent
      const deals = await base44.entities.Deal.filter({ investor_id: profile.id });
      if (deals.length === 0) {
        addResult('Create Test Room', 'error', null, 'No deals found. Create a deal first.');
        setLoadingOp(null);
        return;
      }
      
      const agents = await base44.entities.Profile.filter({ user_role: 'agent' });
      if (agents.length === 0) {
        addResult('Create Test Room', 'error', null, 'No agents found.');
        setLoadingOp(null);
        return;
      }

      const response = await base44.functions.invoke('createDealRoom', {
        dealId: deals[0].id,
        agentProfileId: agents[0].id
      });
      
      const roomId = response?.data?.roomId;
      
      addResult('Create Test Room', 'success', {
        roomId,
        dealId: deals[0].id,
        agentId: agents[0].id
      });
    } catch (error) {
      addResult('Create Test Room', 'error', null, error.message);
    } finally {
      setLoadingOp(null);
    }
  };

  const testMatching = async () => {
    setLoadingOp('matching');
    try {
      const deals = await base44.entities.Deal.filter({ investor_id: profile.id });
      if (deals.length === 0) {
        addResult('Run Matching', 'error', null, 'No deals found. Create a deal first.');
        setLoadingOp(null);
        return;
      }

      const deal = deals[0];
      const response = await matchAgentsForInvestor({
        state: deal.state || 'AZ',
        county: deal.county || 'Maricopa',
        dealId: deal.id,
        limit: 3
      });

      const matches = response.data?.results || [];
      addResult('Run Matching', 'success', {
        matchCount: matches.length,
        matches: matches.map(m => ({
          agentId: m.profile?.id,
          agentName: m.profile?.full_name,
          reason: m.reason,
          score: m.score
        }))
      });
    } catch (error) {
      addResult('Run Matching', 'error', null, error.message);
    } finally {
      setLoadingOp(null);
    }
  };

  if (profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#E3C567]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#E3C567] mb-2">Demo Diagnostics</h1>
        <p className="text-[#808080] mb-8">Quick pre-demo confidence check</p>

        {/* User & Profile Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6">
            <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">User Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#808080]">Email:</dt>
                <dd className="text-[#FAFAFA] font-mono">{user?.email || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#808080]">Role:</dt>
                <dd className="text-[#FAFAFA]">{user?.role || 'N/A'}</dd>
              </div>
            </dl>
          </Card>

          <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6">
            <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">Profile Info</h2>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#808080]">ID:</dt>
                <dd className="text-[#FAFAFA] font-mono text-xs">{profile?.id || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#808080]">User Role:</dt>
                <dd className="text-[#FAFAFA]">{profile?.user_role || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#808080]">KYC Status:</dt>
                <dd className="text-[#FAFAFA]">{profile?.kyc_status || 'unverified'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#808080]">NDA Accepted:</dt>
                <dd className="text-[#FAFAFA]">{profile?.nda_accepted ? 'Yes' : 'No'}</dd>
              </div>
            </dl>
          </Card>
        </div>

        {/* Test Operations */}
        <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6 mb-6">
          <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">Test Operations</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <Button
              onClick={testPingBackend}
              disabled={loadingOp === 'ping'}
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
            >
              {loadingOp === 'ping' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Ping Backend
            </Button>

            <Button
              onClick={testLoadMyDeals}
              disabled={loadingOp === 'deals'}
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
            >
              {loadingOp === 'deals' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Load My Deals
            </Button>

            <Button
              onClick={testCreateDeal}
              disabled={loadingOp === 'create-deal'}
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
            >
              {loadingOp === 'create-deal' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Test Deal
            </Button>

            <Button
              onClick={testCreateRoom}
              disabled={loadingOp === 'create-room'}
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
            >
              {loadingOp === 'create-room' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Test Room
            </Button>

            <Button
              onClick={testMatching}
              disabled={loadingOp === 'matching'}
              className="bg-[#1F1F1F] hover:bg-[#333333] text-[#FAFAFA]"
            >
              {loadingOp === 'matching' && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Run Matching
            </Button>
          </div>
        </Card>

        {/* Results */}
        <Card className="bg-[#0D0D0D] border-[#1F1F1F] p-6">
          <h2 className="text-lg font-semibold text-[#FAFAFA] mb-4">Results</h2>
          {results.length === 0 ? (
            <p className="text-[#808080] text-sm">No operations run yet. Click a button above.</p>
          ) : (
            <div className="space-y-3">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${
                    result.status === 'success'
                      ? 'border-[#10B981]/30 bg-[#10B981]/5'
                      : 'border-[#EF4444]/30 bg-[#EF4444]/5'
                  }`}
                >
                  <div className="flex items-start gap-3 mb-2">
                    {result.status === 'success' ? (
                      <CheckCircle className="w-5 h-5 text-[#10B981] flex-shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-[#FAFAFA] text-sm">
                          {result.operation}
                        </h3>
                        <span className="text-xs text-[#808080]">{result.timestamp}</span>
                      </div>
                      {result.error ? (
                        <p className="text-sm text-[#EF4444]">{result.error}</p>
                      ) : (
                        <pre className="text-xs text-[#808080] overflow-x-auto bg-[#000000] rounded p-2 mt-2">
                          {JSON.stringify(result.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}