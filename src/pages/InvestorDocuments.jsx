import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { FileText, ArrowLeft, Download, Search, Calendar, DollarSign, MapPin } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function InvestorDocumentsContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { profile, loading: profileLoading } = useCurrentProfile();

  // Redirect if profile not found after loading
  useEffect(() => {
    if (!profileLoading && !profile) {
      toast.error("Profile not found. Please complete setup.");
      navigate(createPageUrl("PostAuth"), { replace: true });
    }
  }, [profileLoading, profile, navigate]);

  // Fetch Rooms (Dependent on Profile) - to show shared files per deal
  const { data: rooms = [], isLoading: roomsLoading, refetch } = useQuery({
    queryKey: ['investorRooms', profile?.id],
    queryFn: async () => {
        if (!profile?.id) return [];
        const myRooms = await base44.entities.Room.filter({ investorId: profile.id });
        return myRooms;
    },
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  // Force refresh when component mounts
  useEffect(() => {
    if (profile?.id) {
        refetch();
    }
  }, [profile?.id, refetch]);

  const loading = profileLoading || roomsLoading;

  const filteredRooms = rooms.filter(room => 
    (room.property_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (room.city || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <>
        <Header profile={profile} />
        <div className="min-h-screen bg-transparent flex items-center justify-center">
          <div className="text-center">
            <LoadingAnimation className="w-64 h-64 mx-auto mb-4" />
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

          {rooms.length === 0 ? (
            <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                <div className="w-16 h-16 bg-[#1F1F1F] rounded-full flex items-center justify-center mx-auto mb-4">
                    <FileText className="w-8 h-8 text-[#808080]" />
                </div>
                <h3 className="text-xl font-bold text-[#FAFAFA] mb-2">No Shared Files Yet</h3>
                <p className="text-[#808080] mb-6 max-w-md mx-auto">
                    Files shared in your deal rooms will appear here automatically.
                </p>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="text-center py-12 text-[#808080]">
                No results matching "{searchTerm}"
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredRooms.map((room) => (
                    <div key={room.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-xl overflow-hidden hover:border-[#E3C567] transition-all group">
                        <div className="p-5">
                            <div className="flex items-start justify-between mb-4">
                                <div className="w-10 h-10 bg-[#E3C567]/10 rounded-lg flex items-center justify-center group-hover:bg-[#E3C567]/20 transition-colors">
                                    <FileText className="w-5 h-5 text-[#E3C567]" />
                                </div>
                                <Link to={`${createPageUrl("Room")}?roomId=${room.id}`} className="text-xs text-[#E3C567] hover:underline ml-2">Open Room</Link>
                            </div>
                            
                            <h3 className="font-bold text-[#FAFAFA] truncate mb-1" title={room.property_address}>
                                {room.property_address || [room.city, room.state].filter(Boolean).join(', ') || 'Deal'}
                            </h3>
                            <div className="text-xs text-[#808080] flex items-center gap-1 mb-4">
                                <MapPin className="w-3 h-3" />
                                {[room.city, room.state].filter(Boolean).join(', ')}
                            </div>
                            
                            <div className="space-y-2">
                              {room.files && room.files.length > 0 ? (
                                room.files.map((f, idx) => (
                                  <div key={idx} className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                                    <div className="min-w-0">
                                      <p className="text-sm text-[#FAFAFA] truncate">{f.name || 'Document'}</p>
                                      <p className="text-xs text-[#808080] truncate">{f.uploaded_by_name || 'Shared'} • {new Date(f.uploaded_at || room.updated_date || room.created_date).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2 flex-shrink-0 ml-3">
                                      <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-[#1F1F1F] text-[#FAFAFA] px-3 py-1.5 rounded-full hover:bg-[#333]">View</a>
                                      <a href={f.url} download={f.name || 'download'} className="text-xs bg-[#E3C567] text-black px-3 py-1.5 rounded-full hover:bg-[#EDD89F] flex items-center gap-1">
                                        <Download className="w-3 h-3" /> Download
                                      </a>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="text-sm text-[#808080] bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">No shared files yet</div>
                              )}
                            </div>
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