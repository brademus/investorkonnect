import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { FileText, ArrowLeft, Download, Search, Calendar, DollarSign, MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";

function InvestorDocumentsContent() {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [deals, setDeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      const profiles = await base44.entities.Profile.filter({ user_id: user.id });
      const myProfile = profiles[0];
      setProfile(myProfile);

      if (myProfile) {
        // Fetch deals for this investor that have a contract URL
        // Privacy enforcement: Filtering by investor_id ensures users only see their own deals
        const myDeals = await base44.entities.Deal.filter(
            { investor_id: myProfile.id }, 
            { created_date: -1 }
        );
        
        // Filter out deals without contracts, but be lenient - maybe some have it but empty string?
        // Show all active deals or deals with contract_url
        setDeals(myDeals.filter(d => d.contract_url || d.status === 'active'));
      }
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredDeals = deals.filter(deal => 
    deal.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    deal.property_address?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-[#E3C567] animate-spin mx-auto mb-4" />
            <p className="text-[#808080] text-sm">Loading documents...</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#050505] bg-opacity-90">
        <div className="max-w-6xl mx-auto px-6 py-12">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
            <div>
                <Link to={createPageUrl("Dashboard")} className="inline-flex items-center gap-2 text-sm text-[#808080] hover:text-[#E3C567] mb-2 transition-colors">
                <ArrowLeft className="w-4 h-4" />
                Back to Dashboard
                </Link>
                <h1 className="text-3xl font-bold text-[#E3C567] font-serif">My Documents</h1>
                <p className="text-[#808080] mt-1">Manage and access your deal contracts.</p>
            </div>
            
            <div className="relative w-full md:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#808080]" />
                <Input 
                    placeholder="Search documents..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-[#0D0D0D] border-[#1F1F1F] text-[#FAFAFA] focus:border-[#E3C567] rounded-full"
                />
            </div>
          </div>

          {deals.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#808080]" />
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">No Documents Yet</h3>
                <p className="text-[#808080] mb-6 max-w-md mx-auto">
                    Contracts uploaded via the Deal Wizard will appear here automatically.
                </p>
                <Link to={createPageUrl("DealWizard")}>
                    <Button className="bg-[#E3C567] hover:bg-[#D4AF37] text-black rounded-full font-semibold">
                        Start New Deal
                    </Button>
                </Link>
            </div>
          ) : filteredDeals.length === 0 ? (
            <div className="text-center py-12 text-[#808080]">
                No documents matching "{searchTerm}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredDeals.map((deal) => (
                    <div key={deal.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl overflow-hidden hover:border-[#E3C567] transition-all group">
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center group-hover:bg-[#E3C567]/20 transition-colors">
                                    <FileText className="w-5 h-5 text-[#E3C567]" />
                                </div>
                                <span className="text-xs font-medium px-2 py-1 rounded bg-[#1F1F1F] text-[#808080] border border-[#333]">
                                    Purchase Agreement
                                </span>
                            </div>
                            
                            <h3 className="font-bold text-[#FAFAFA] truncate mb-1" title={deal.property_address}>
                                {deal.property_address || deal.title}
                            </h3>
                            <div className="text-xs text-[#808080] flex items-center gap-1 mb-4">
                                <MapPin className="w-3 h-3" />
                                {deal.city}, {deal.state} {deal.zip}
                            </div>
                            
                            <div className="space-y-2 mb-5">
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">Price</span>
                                    <span className="text-[#FAFAFA] font-medium">${(deal.purchase_price || 0).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-[#666]">Uploaded</span>
                                    <span className="text-[#FAFAFA]">{deal.created_date ? format(new Date(deal.created_date), 'MMM d, yyyy') : '-'}</span>
                                </div>
                            </div>
                            
                            <a 
                                href={deal.contract_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="block w-full"
                            >
                                <Button variant="outline" className="w-full border-[#333] hover:bg-[#1F1F1F] text-[#E3C567] hover:text-[#E3C567] hover:border-[#E3C567]">
                                    <Download className="w-4 h-4 mr-2" />
                                    Download PDF
                                </Button>
                            </a>
                        </div>
                    </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function InvestorDocuments() {
  return (
    <AuthGuard requireAuth={true}>
      <InvestorDocumentsContent />
    </AuthGuard>
  );
}