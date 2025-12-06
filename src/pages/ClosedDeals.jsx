import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { DollarSign, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

function ClosedDealsContent() {
  const { profile } = useCurrentProfile();

  return (
    <>
      <Header profile={profile} />
      <div className="min-h-screen bg-[#0F0F0F]">
        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Back Button */}
          <Link 
            to={createPageUrl("Dashboard")} 
            className="inline-flex items-center gap-2 text-[#A6A6A6] hover:text-[#E5C37F] mb-6 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Dashboard</span>
          </Link>

          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-[#34D399] mb-2">Closed Deals</h1>
            <p className="text-[#A6A6A6]">
              Successfully completed transactions
            </p>
          </div>

          {/* Empty State */}
          <div className="bg-[#1A1A1A] border border-[#333333] rounded-3xl p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-[#34D399]/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <DollarSign className="w-8 h-8 text-[#34D399]" />
              </div>
              <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">No Closed Deals Yet</h3>
              <p className="text-[#A6A6A6] mb-6">
                Your completed deals will appear here. Start working on active deals to close your first transaction.
              </p>
              <Button
                onClick={() => window.location.href = createPageUrl("DealRooms")}
                className="bg-gradient-to-r from-[#E5C37F] to-[#C9A961] hover:from-[#F0D699] hover:to-[#D4AF37] text-[#0F0F0F] px-8 rounded-full"
              >
                View Deal Rooms
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function ClosedDeals() {
  return (
    <AuthGuard requireAuth={true}>
      <ClosedDealsContent />
    </AuthGuard>
  );
}