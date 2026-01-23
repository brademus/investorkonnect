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
import { buildUnifiedFilesList } from "@/components/utils/dealDocuments";


function AgentDocumentsContent() {
  const { profile, loading: profileLoading } = useCurrentProfile();
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch my rooms to show shared files per address (function + fallback to entity filter)
  const { data: rooms = [], isLoading: roomsLoading, refetch } = useQuery({
    queryKey: ['agentRooms', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];
      const respEnriched = await base44.functions.invoke('listMyRoomsEnriched');
      const rooms = respEnriched?.data?.rooms || [];
      return rooms.map(r => ({ ...r, files: Array.isArray(r.files) ? r.files : [], photos: Array.isArray(r.photos) ? r.photos : [] }));
    },
    enabled: !!profile?.id,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true
  });

  // We do not need deals here; we mirror the Files tab by using the room.files/photos directly.

  useEffect(() => {
    if (profile?.id) {
      refetch();
    }
  }, [profile?.id, refetch]);


  // Only show rooms where both investor and agent have signed the agreement
  const isFullySigned = (r) => {
    const a = (r?.agreement_status || '').toLowerCase();
    const req = (r?.request_status || '').toLowerCase();
    return a === 'fully_signed' || req === 'signed' || !!r?.signed_at;
  };

  const groups = React.useMemo(() => {
    const map = new Map();
    const norm = (s) => (s || '').toString().trim().toLowerCase();

    const onlySigned = rooms.filter(isFullySigned);
    onlySigned.forEach((r) => {
      const key = r.deal_id || `${norm(r.property_address)}|${norm(r.city)}|${norm(r.state)}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          deal_id: r.deal_id,
          addressLabel: r.property_address || [r.city, r.state].filter(Boolean).join(', ') || 'Deal',
          city: r.city,
          state: r.state,
          roomIds: [],
          openRoomId: null,
          files: [],
          updated: r.updated_date || r.created_date,
        });
      }
      const g = map.get(key);
      g.roomIds.push(r.id);
      if (!g.openRoomId && r.id && !String(r.id).startsWith('virtual_')) {
        g.openRoomId = r.id;
      }
      // Build the exact same list as the Files tab
      const existingUrls = new Set(g.files.map(f => f.url));
      const unified = buildUnifiedFilesList({ room: r }) || [];
      const normalized = unified.map(x => ({
        name: x.name || x.filename || x.label || 'Document',
        url: x.url || x.urlSignedPdf || x.file_url,
        uploaded_by_name: x.uploaded_by_name || x.uploadedBy || 'Shared',
        uploaded_at: x.uploaded_at || x.createdAt || r.updated_date || r.created_date,
        size: x.size,
        type: x.type
      }));
      // Sort newest first
      normalized.sort((a, b) => new Date(b?.uploaded_at || 0) - new Date(a?.uploaded_at || 0));
      normalized.forEach(f => {
        if (f?.url && !existingUrls.has(f.url)) {
          g.files.push(f);
          existingUrls.add(f.url);
        }
      });
      // keep freshest updated
      if (new Date(r.updated_date || 0) > new Date(g.updated || 0)) {
        g.updated = r.updated_date;
      }
      // Prefer non-empty address label
      if (!g.addressLabel || g.addressLabel === 'Deal') {
        g.addressLabel = r.property_address || g.addressLabel;
      }
    });

    // Sort files within each group (newest first)
    for (const g of map.values()) {
      g.files.sort((a, b) => new Date(b?.uploaded_at || 0) - new Date(a?.uploaded_at || 0));
    }
    // Return array sorted by recent activity
    return Array.from(map.values()).sort((a, b) => new Date(b.updated || 0) - new Date(a.updated || 0));
  }, [rooms]);

  const filteredGroups = groups.filter(g => {
    const q = searchTerm.toLowerCase();
    return (
      (g.addressLabel || '').toLowerCase().includes(q) ||
      (g.city || '').toLowerCase().includes(q) ||
      (g.state || '').toLowerCase().includes(q)
    );
  });

  // If rooms are still loading OR we have zero rooms and still waiting on function fallback, show loader briefly
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
            {filteredGroups.length === 0 ? (
              <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-12 text-center">
                <FileText className="w-16 h-16 text-[#333] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#808080] mb-2">No Shared Files</h3>
                <p className="text-[#666]">Shared files from your deal rooms will appear here.</p>
              </div>
            ) : (
              filteredGroups.map((group) => (
                <div key={group.key} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6 hover:border-[#E3C567] transition-all">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[#FAFAFA] mb-1 truncate">
                        {group.addressLabel}
                      </h3>
                      <div className="text-sm text-[#808080]">
                        {[group.city, group.state].filter(Boolean).join(', ')}
                        {group.roomIds?.length ? (
                          <span className="ml-2 text-[#666]">• {group.roomIds.length} room{group.roomIds.length > 1 ? 's' : ''}</span>
                        ) : null}
                      </div>
                    </div>
                    {group.openRoomId && (
                      <Link to={`${createPageUrl("Room")}?roomId=${group.openRoomId}`} className="text-xs text-[#E3C567] hover:underline ml-3 flex-shrink-0">Open Room</Link>
                    )}
                  </div>

                  <div className="mt-4 space-y-2">
                    {group.files.length > 0 ? (
                      group.files.map((f, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-[#141414] border border-[#1F1F1F] rounded-lg p-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 bg-[#E3C567]/15 rounded flex items-center justify-center flex-shrink-0">
                              <FileText className="w-4 h-4 text-[#E3C567]" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm text-[#FAFAFA] truncate">{f.name || 'Document'}</p>
                              <p className="text-xs text-[#808080] truncate">
                                {(f.uploaded_by_name || 'Shared')} • {new Date(f.uploaded_at || group.updated).toLocaleDateString()}
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