import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useRoomMessages } from "@/components/room/useRoomMessages";
import { Button } from "@/components/ui/button";
import { Info, Shield, FileText, Image, User, Plus, Download, Activity, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import SimpleAgreementPanel from "@/components/SimpleAgreementPanel";
import KeyTermsPanel from "@/components/room/KeyTermsPanel";
import PropertyDetailsCard from "@/components/PropertyDetailsCard";
import InlineWalkthroughStatus from "@/components/room/InlineWalkthroughStatus.jsx";
import { PIPELINE_STAGES, normalizeStage, stageOrder } from "@/components/pipelineStages";
import FilesTab from "@/components/room/FilesTab.jsx";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";
import DealActivityTab from "@/components/room/DealActivityTab.jsx";
import DealNextStepCTA from "@/components/room/DealNextStepCTA.jsx";
import WalkthroughScheduleModal from "@/components/room/WalkthroughScheduleModal.jsx";

function WalkthroughStatusLine({ dealId, roomId, deal, isSigned }) {
  const [status, setStatus] = useState(null);
  const [confirmedDate, setConfirmedDate] = useState(null);

  useEffect(() => {
    if (!dealId) return;
    base44.entities.DealAppointments.filter({ dealId }).then(rows => {
      const wt = rows?.[0]?.walkthrough;
      if (wt) {
        setStatus(wt.status);
        if ((wt.status === 'SCHEDULED' || wt.status === 'COMPLETED') && wt.datetime) {
          setConfirmedDate(wt.datetime);
        }
      }
    }).catch(() => {});

    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === dealId && e.data.walkthrough) {
        const wt = e.data.walkthrough;
        setStatus(wt.status);
        if ((wt.status === 'SCHEDULED' || wt.status === 'COMPLETED') && wt.datetime) {
          setConfirmedDate(wt.datetime);
        }
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [dealId]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Message.subscribe(e => {
      const d = e?.data;
      if (!d || d.room_id !== roomId) return;
      if (d.metadata?.type === "walkthrough_response" && d.metadata?.status === "confirmed") {
        setStatus("SCHEDULED");
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  const dealConfirmed = deal?.walkthrough_confirmed === true;
  const isConfirmed = status === 'SCHEDULED' || status === 'COMPLETED' || dealConfirmed;

  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
  const wtTime = deal?.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
  const hasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtSlots.length > 0);

  // Build all display items (slots or legacy single date)
  const allSlots = wtSlots.length > 0 ? wtSlots : (wtDate ? [{ date: wtDate, timeStart: wtTime, timeEnd: null }] : []);

  // Build confirmed label
  let confirmedLabel = 'Confirmed';
  if (isConfirmed) {
    if (confirmedDate) {
      try { confirmedLabel = new Date(confirmedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); } catch (_) { confirmedLabel = confirmedDate; }
    } else if (deal?.walkthrough_confirmed_date) {
      const d = deal.walkthrough_confirmed_date;
      const t = deal.walkthrough_confirmed_time;
      confirmedLabel = t ? `${d} at ${t}` : d;
    }
  }

  if (!hasWalkthrough) return null;

  // If confirmed, show single line
  if (isConfirmed) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <Calendar className="w-4 h-4 text-[#34D399]" />
        <span className="text-sm text-[#808080]">Walk-through:</span>
        <span className="text-sm font-medium text-[#34D399]">{confirmedLabel}</span>
      </div>
    );
  }

  // After signing — show "To Be Determined" (agent picks in deal progress panel)
  if (isSigned) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <Calendar className="w-4 h-4 text-[#F59E0B]" />
        <span className="text-sm text-[#808080]">Walk-through:</span>
        <span className="text-sm font-medium text-[#F59E0B]">To Be Determined</span>
      </div>
    );
  }

  // Before signing — show all proposed available times
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center gap-2">
        <Calendar className="w-4 h-4 text-[#E3C567]" />
        <span className="text-sm text-[#808080]">Walk-through</span>
      </div>
      <div className="space-y-1.5 ml-6">
        <p className="text-xs text-[#808080]">Available times:</p>
        {allSlots.map((slot, idx) => {
          const timeLabel = [slot.timeStart, slot.timeEnd].filter(Boolean).join(' – ') || null;
          return (
            <div key={idx} className="flex items-center gap-2.5 p-2.5 bg-[#141414] rounded-lg border border-[#1F1F1F] text-xs">
              <Calendar className="w-3.5 h-3.5 text-[#E3C567] flex-shrink-0" />
              <span className="text-[#FAFAFA] font-medium">
                {allSlots.length > 1 ? `Option ${idx + 1}: ` : ''}{slot.date}
              </span>
              {timeLabel && <span className="text-[#808080]">{timeLabel.replace(/(AM|PM)/g, ' $1').trim()}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function DealBoard({ deal, room, profile, roomId, onInvestorSigned, selectedAgentProfileId }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [wtModalOpen, setWtModalOpen] = useState(false);
  // localDocsRef is the single source of truth for documents uploaded in this session.
  // It NEVER gets cleared — it only grows. This ensures no real-time event or prop change can erase uploads.
  const localDocsRef = useRef({});
  const [localDeal, setLocalDeal] = useState(() => {
    if (!deal) return deal;
    return { ...deal, documents: { ...(deal?.documents || {}), ...localDocsRef.current } };
  });

  useEffect(() => {
    if (!deal) return;
    setLocalDeal(() => {
      // Always merge: incoming deal + anything we've uploaded locally
      const mergedDocs = { ...(deal.documents || {}), ...localDocsRef.current };
      return { ...deal, documents: mergedDocs };
    });
  }, [deal]);

  const [localRoom, setLocalRoom] = useState(room);
  useEffect(() => { if (room) setLocalRoom(room); }, [room]);

  // Shared messages hook — no duplicate fetch
  const { messages: roomMessages } = useRoomMessages(roomId);
  const messagePhotos = useMemo(() =>
    (roomMessages || [])
      .filter(m => m?.metadata?.file_url && (m?.metadata?.type === 'photo' || (m?.metadata?.file_type || '').startsWith('image/')))
      .map(m => ({
        name: m.metadata.file_name || 'Photo',
        url: m.metadata.file_url,
        uploaded_by: m.sender_profile_id,
        uploaded_at: m.created_date,
        source: 'message'
      })),
    [roomMessages]
  );

  // Track which tabs have been visited to avoid unmounting/remounting
  const [visitedTabs, setVisitedTabs] = useState(new Set(['details']));
  useEffect(() => {
    setVisitedTabs(prev => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  const isInvestor = profile?.user_role === 'investor' || isAdmin;
  const isAgent = !isAdmin && profile?.user_role === 'agent';
  const isSigned = room?.is_fully_signed || room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || deal?.is_fully_signed;
  const maskAddr = isAgent && !isSigned;

  const tabs = isSigned
    ? [{ id: 'details', label: 'Details', icon: Info }, { id: 'agreement', label: 'Agreement', icon: Shield }, { id: 'files', label: 'Files', icon: FileText }, { id: 'photos', label: 'Photos', icon: Image }, { id: 'activity', label: 'Activity', icon: Activity }]
    : [{ id: 'details', label: 'Details', icon: Info }];

  // Open agreement tab if URL param (only if signed, otherwise stay on details)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') === 'agreement') setActiveTab(isSigned ? 'agreement' : 'details');
  }, [isSigned]);

  const uploadToRoom = async (type) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (type === 'photo') { input.accept = 'image/*'; input.multiple = true; }
    input.onchange = async (e) => {
      const files = Array.from(e.target.files);
      if (!files.length) return;
      for (const f of files) { const v = type === 'photo' ? validateImage(f) : validateSafeDocument(f); if (!v.valid) { toast.error(v.error); return; } }
      toast.info(`Uploading ${files.length} file(s)...`);
      try {
        const uploads = await Promise.all(files.map(async f => {
          const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
          return { name: f.name, url: file_url, uploaded_by: profile?.id, uploaded_by_name: profile?.full_name || profile?.email, uploaded_at: new Date().toISOString(), size: f.size, type: f.type };
        }));
        const key = type === 'photo' ? 'photos' : 'files';
        const existing = localRoom?.[key] || [];
        const merged = [...existing, ...uploads].filter((p, i, arr) => p?.url && arr.findIndex(x => x?.url === p.url) === i);
        await base44.entities.Room.update(roomId, { [key]: merged });
        setLocalRoom(prev => prev ? { ...prev, [key]: merged } : prev);
        toast.success(`Uploaded ${files.length} file(s)`);
      } catch (_) { toast.error('Upload failed'); }
    };
    input.click();
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Tab Nav */}
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-2 flex gap-2 overflow-x-auto">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all ${activeTab === tab.id ? 'bg-[#E3C567] text-black shadow-lg' : 'text-[#808080] hover:bg-[#1F1F1F] hover:text-[#FAFAFA]'}`}>
              <Icon className="w-4 h-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* Details Tab */}
      {activeTab === 'details' && (
        <div className="space-y-6">
          {maskAddr && (
            <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-5 flex items-start gap-3">
              <Shield className="w-5 h-5 text-[#F59E0B] mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-md font-bold text-[#F59E0B] mb-1">Limited Access</h4>
                <p className="text-sm text-[#FAFAFA]/80">Full details unlock after both parties sign.</p>
              </div>
            </div>
          )}
          {/* Deal Header */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h3 className="text-2xl font-bold text-[#E3C567] mb-2">{maskAddr ? `Deal in ${[deal?.city, deal?.state].filter(Boolean).join(', ')}` : (deal?.property_address || 'Property')}</h3>
            <p className="text-sm text-[#808080] mb-3">{[deal?.city, deal?.state].filter(Boolean).join(', ')}</p>
            <div className="text-3xl font-bold text-[#34D399] mb-4">${(deal?.purchase_price || room?.budget || 0).toLocaleString()}</div>
            <p className="text-xs text-[#808080] -mt-3 mb-3">Contract Price</p>
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
              {deal?.pipeline_stage ? deal.pipeline_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'New Deal'}
            </span>
            <WalkthroughStatusLine dealId={localDeal?.id} roomId={roomId} deal={localDeal} isSigned={isSigned} />
          </div>

          {/* Property Details (left) + Key Terms (right) side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PropertyDetailsCard deal={localDeal || {}} />
            <KeyTermsPanel deal={localDeal} room={localRoom} profile={profile} selectedAgentId={selectedAgentProfileId} isSigned={isSigned} />
          </div>

          {/* Agreement actions (below, full width) */}
          {!isSigned && (
            <div data-agreement-panel className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
              <SimpleAgreementPanel dealId={deal?.id || room?.deal_id} roomId={roomId} profile={profile} deal={localDeal} onInvestorSigned={onInvestorSigned} selectedAgentProfileId={selectedAgentProfileId} inline />
            </div>
          )}

          {/* Walkthrough Schedule Modal (triggered by CTA) */}
          <WalkthroughScheduleModal
            open={wtModalOpen}
            onOpenChange={setWtModalOpen}
            deal={localDeal}
            roomId={roomId}
            profile={profile}
            onScheduled={(updated) => {
              setLocalDeal(prev => prev ? { ...prev, ...updated } : prev);
            }}
          />

          {/* Deal Progress with inline Next Step CTA */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Deal Progress</h4>
            <div className="space-y-3">
              {PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(stage => {
                const norm = normalizeStage(localDeal?.pipeline_stage);
                const isActive = norm === stage.id;
                const isPast = stage.order < stageOrder(norm);
                const handleStageClick = async () => {
                  if (!localDeal?.id) return;
                  await base44.functions.invoke('updateDealDocuments', { dealId: localDeal.id, pipeline_stage: stage.id });
                  toast.success(`Moved to ${stage.label}`);
                  if (stage.id === 'completed' || stage.id === 'canceled') {
                    const agentId = localDeal.locked_agent_id || localRoom?.locked_agent_id || localRoom?.agent_ids?.[0];
                    if (agentId) {
                      navigate(`${createPageUrl("RateAgent")}?dealId=${localDeal.id}&agentProfileId=${agentId}&returnTo=Pipeline`);
                    }
                  }
                };
                return (
                  <div key={stage.id}>
                    <button onClick={handleStageClick} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-[#141414] transition-colors cursor-pointer">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#E3C567] ring-2 ring-[#E3C567] ring-offset-2 ring-offset-black' : isPast ? 'bg-[#34D399]' : 'bg-[#1F1F1F]'}`}>
                        <span className="text-sm font-bold text-white">{isPast ? '✓' : stage.order}</span>
                      </div>
                      <div><p className={`text-sm font-medium ${isActive ? 'text-[#FAFAFA]' : isPast ? 'text-[#808080]' : 'text-[#666]'}`}>{stage.label}</p>{isActive && <p className="text-xs text-[#E3C567]">Current</p>}</div>
                    </button>
                    {isActive && (
                      <div className="ml-[52px] mt-2 mb-1 space-y-3">
                        <DealNextStepCTA
                          deal={localDeal}
                          room={localRoom}
                          profile={profile}
                          roomId={roomId}
                          inline
                          onDealUpdate={(patch) => {
                            if (!patch) return;
                            if (patch.documents) {
                              localDocsRef.current = { ...localDocsRef.current, ...patch.documents };
                            }
                            setLocalDeal(prev => {
                              if (!prev) return prev;
                              const updated = { ...prev, ...patch };
                              updated.documents = { ...(updated.documents || {}), ...localDocsRef.current };
                              return updated;
                            });
                          }}
                          onOpenWalkthroughModal={() => setWtModalOpen(true)}
                        />
                        {stage.id === 'connected_deals' && (
                          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-3">
                            <p className="text-xs font-semibold text-[#FAFAFA] mb-2">Walk-through</p>
                            <InlineWalkthroughStatus deal={localDeal} room={localRoom} profile={profile} roomId={roomId} />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* Agreement Tab (only shown after signing) — keep mounted once visited */}
      {visitedTabs.has('agreement') && (
        <div className="space-y-6" style={{ display: activeTab === 'agreement' ? 'flex' : 'none', flexDirection: 'column', gap: '1.5rem' }}>
          <SimpleAgreementPanel dealId={deal?.id || room?.deal_id} roomId={roomId} profile={profile} deal={localDeal} onInvestorSigned={onInvestorSigned} selectedAgentProfileId={selectedAgentProfileId} />
          <KeyTermsPanel deal={localDeal} room={localRoom} profile={profile} selectedAgentId={selectedAgentProfileId} />
        </div>
      )}

      {/* Files Tab — keep mounted once visited */}
      {visitedTabs.has('files') && (
        <div style={{ display: activeTab === 'files' ? 'block' : 'none' }}>
          <FilesTab deal={localDeal} room={localRoom} roomId={roomId} profile={profile} />
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold text-[#FAFAFA]">Photos</h4>
            <Button onClick={() => uploadToRoom('photo')} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full"><Plus className="w-4 h-4 mr-2" />Upload</Button>
          </div>
          {(() => {
            // Merge room.photos + message photos, dedupe by URL
            const seenUrls = new Set();
            const allPhotos = [];
            for (const p of (localRoom?.photos || [])) { if (p?.url && !seenUrls.has(p.url)) { seenUrls.add(p.url); allPhotos.push(p); } }
            for (const p of messagePhotos) { if (p?.url && !seenUrls.has(p.url)) { seenUrls.add(p.url); allPhotos.push(p); } }
            return allPhotos.length === 0 ? <p className="text-sm text-[#808080] text-center py-12">No photos yet</p> : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {allPhotos.map((p, i) => (
                  <div key={i} className="group relative aspect-square rounded-lg overflow-hidden bg-[#141414] border border-[#1F1F1F] hover:border-[#E3C567]/30">
                    <img src={p.url} alt={p.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="bg-[#E3C567] text-black px-4 py-2 rounded-full text-sm font-medium">View</a>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Activity Tab — keep mounted once visited */}
      {visitedTabs.has('activity') && (
        <div style={{ display: activeTab === 'activity' ? 'block' : 'none' }}>
          <DealActivityTab dealId={deal?.id} roomId={roomId} />
        </div>
      )}
    </div>
  );
}