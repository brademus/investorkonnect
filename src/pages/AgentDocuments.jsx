import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { base44 } from "@/api/base44Client";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, ArrowLeft, Download, Search } from "lucide-react";
import LoadingAnimation from "@/components/LoadingAnimation";

function AgentDocumentsContent() {
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch my rooms to show shared files per address (use function to ensure access rules)
  const { data: rooms = [], isLoading: roomsLoading } = useQuery({
    queryKey: ['agentRooms', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const resp = await base44.functions.invoke('listMyRooms');
      return getRoomsFromListMyRoomsResponse(resp);
    },
    enabled: !!profile?.id
  });

  const filteredRooms = rooms.filter(room => {
    const searchLower = searchTerm.toLowerCase();
    const address = (room.property_address || '').toLowerCase();
    const city = (room.city || '').toLowerCase();
    const state = (room.state || '').toLowerCase();
    return address.includes(searchLower) || city.includes(searchLower) || state.includes(searchLower);
  });

  if (profileLoading || roomsLoading) {
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

          {/* Documents List: one card per address with shared files */}
          <div className="space-y-4">
            {filteredRooms.length === 0 ? (
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                <FileText className="w-16 h-16 text-[#333] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#808080] mb-2">No Shared Files</h3>
                <p className="text-[#666]">Shared files from your deal rooms will appear here.</p>
              </div>
            ) : (
              filteredRooms.map((room) => (
                <div key={room.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#E3C567] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#FAFAFA] mb-1 truncate">
                        {room.property_address || [room.city, room.state].filter(Boolean).join(', ') || 'Deal'}
                      </h3>
                      <div className="text-sm text-[#808080]">
                        {[room.city, room.state].filter(Boolean).join(', ')}
                      </div>
                    </div>
                    <Link to={`${createPageUrl("Room")}?roomId=${room.id}`} className="text-xs text-[#E3C567] hover:underline ml-3 flex-shrink-0">Open Room</Link>
                  </div>

                  <div className="mt-4 space-y-2">
                    {Array.isArray(room.files) && room.files.length > 0 ? (
                      room.files.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-[#E3C567]/15 rounded flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-[#E3C567]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-[#FAFAFA] truncate">{f.name || 'Document'}</p>
                              <p className="text-xs text-[#808080] truncate">
                                {(f.uploaded_by_name || 'Shared')} • {new Date(f.uploaded_at || room.updated_date || room.created_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-xs bg-[#1F1F1F] text-[#FAFAFA] px-3 py-1.5 rounded-full hover:bg-[#333]">View</a>
                            <a href={f.url} download={f.name || 'download'} className="text-xs bg-[#E3C567] text-black px-3 py-1.5 rounded-full hover:bg-[#EDD89F] flex items-center gap-1">
                              <Download className="w-3 h-3" /> Download
                            </a>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-[#808080] bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">No shared files yet for this address</div>
                    )}
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