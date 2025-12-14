import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, ArrowLeft, Download, Search } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

function AgentDocumentsContent() {
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch deals with contracts
  const { data: deals = [], isLoading: dealsLoading } = useQuery({
    queryKey: ['agentDeals', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const res = await base44.entities.Deal.filter({ 
        agent_id: profile.id 
      });
      return res.filter(d => d.contract_document?.url || d.contract_url);
    },
    enabled: !!profile?.id
  });

  const filteredDeals = deals.filter(deal => {
    const searchLower = searchTerm.toLowerCase();
    return (
      deal.property_address?.toLowerCase().includes(searchLower) ||
      deal.city?.toLowerCase().includes(searchLower) ||
      deal.state?.toLowerCase().includes(searchLower)
    );
  });

  if (profileLoading || dealsLoading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <LoadingAnimation className="w-64 h-64" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-transparent py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[#E3C567]/20 rounded-xl flex items-center justify-center">
              <FileText className="w-6 h-6 text-[#E3C567]" />
            </div>
            <h1 className="text-3xl font-bold text-[#E3C567]">Deal Documents</h1>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#808080]" />
              <Input
                placeholder="Search by address or location..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-12 bg-[#141414] border-[#1F1F1F] text-[#FAFAFA]"
              />
            </div>
          </div>

          {/* Documents List */}
          <div className="space-y-4">
            {filteredDeals.length === 0 ? (
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                <FileText className="w-16 h-16 text-[#333] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#808080] mb-2">No Documents</h3>
                <p className="text-[#666]">Deal contracts will appear here once uploaded by investors.</p>
              </div>
            ) : (
              filteredDeals.map(deal => (
                <div key={deal.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#E3C567] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">{deal.property_address}</h3>
                      <div className="flex items-center gap-4 text-sm text-[#808080] mb-3">
                        <span>{deal.city}, {deal.state}</span>
                        {deal.purchase_price && (
                          <span className="text-[#E3C567]">
                            ${new Intl.NumberFormat('en-US').format(deal.purchase_price)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#666]">
                        Uploaded {new Date(deal.contract_document?.uploaded_at || deal.created_date).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={deal.contract_document?.url || deal.contract_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-4 py-2 bg-[#E3C567] text-black rounded-lg hover:bg-[#EDD89F] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}

export default function AgentDocuments() {
  return (
    <AuthGuard requireAuth={true}>
      <AgentDocumentsContent />
    </AuthGuard>
  );
}