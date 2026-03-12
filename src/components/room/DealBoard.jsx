import React, { useState, useEffect, useRef, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useRoomMessages } from "@/components/room/useRoomMessages";
import { Button } from "@/components/ui/button";
import { Info, Shield, FileText, Image, User, Plus, Download, Activity, Calendar } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { reportError } from "@/components/utils/reportError";
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
import FileViewerModal from "@/components/room/FileViewerModal.jsx";

function WalkthroughStatusLine({ deal, isSigned, externalStatus }) {
  const status = externalStatus || null;
  const dealConfirmed = deal?.walkthrough_confirmed === true;
  const isConfirmed = status === 'SCHEDULED' || status === 'COMPLETED' || dealConfirmed;

  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date && String(deal.walkthrough_date).length >= 8 ? deal.walkthrough_date : null;
  const wtTime = deal?.walkthrough_time && String(deal.walkthrough_time).length >= 3 ? deal.walkthrough_time : null;
  const hasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtSlots.length > 0);

  const allSlots = wtSlots.length > 0 ? wtSlots : (wtDate ? [{ date: wtDate, timeStart: wtTime, timeEnd: null }] : []);

  let confirmedLabel = 'Confirmed';
  if (isConfirmed) {
    if (deal?.walkthrough_confirmed_date) {
      const d = deal.walkthrough_confirmed_date;
      const t = deal.walkthrough_confirmed_time;
      confirmedLabel = t ? `${d} at ${t}` : d;
    }
  }

  if (!hasWalkthrough) return null;

  if (isConfirmed) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <Calendar className="w-4 h-4 text-[#34D399]" />
        <span className="text-sm text-[#808080]">Walk-through:</span>
        <span className="text-sm font-medium text-[#34D399]">{confirmedLabel}</span>
      </div>
    );
  }

  if (isSigned) {
    return (
      <div className="flex items-center gap-2 mt-3">
        <Calendar className="w-4 h-4 text-[#F59E0B]" />
        <span className="text-sm text-[#808080]">Walk-through:</span>
        <span className="text-sm font-medium text-[#F59E0B]">To Be Determined</span>
      </div>
    );
  }

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

export default function DealBoard({ deal, room, profile, roomId, onInvestorSigned, selectedAgentProfileId, patchDealCache }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [wtModalOpen, setWtModalOpen] = useState(false);
  const [viewerFile, setViewerFile] = useState(null);
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
      const merged = { ...deal, documents: mergedDocs };
      // Ensure walkthrough_slots is always an array (never accidentally converted to string)
      if (merged.walkthrough_slots && !Array.isArray(merged.walkthrough_slots)) {
        try {
          merged.walkthrough_slots = typeof merged.walkthrough_slots === 'string' 
            ? JSON.parse(merged.walkthrough_slots) 
            : [];
        } catch (_) {
          merged.walkthrough_slots = [];
        }
      }
      return merged;
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
  // Shared walkthrough state — lifted here so sub-components don't each create their own subscriptions
  const [wtStatus, setWtStatus] = useState(null);
  const [wtProposedBy, setWtProposedBy] = useState(null);
  const [wtLoaded, setWtLoaded] = useState(false);

  useEffect(() => {
    const dId = localDeal?.id || deal?.id;
    if (!dId) return;
    setWtLoaded(false);
    base44.entities.DealAppointments.filter({ dealId: dId }).then(rows => {
      const wt = rows?.[0]?.walkthrough;
      if (wt) {
        setWtStatus(wt.status);
        if (wt.updatedByUserId) setWtProposedBy(wt.updatedByUserId);
      }
      setWtLoaded(true);
    }).catch(() => { setWtLoaded(true); });

    const unsub1 = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === dId && e.data.walkthrough?.status) {
        setWtStatus(e.data.walkthrough.status);
        if (e.data.walkthrough.updatedByUserId) setWtProposedBy(e.data.walkthrough.updatedByUserId);
      }
    });
    const unsub2 = base44.entities.Message.subscribe(e => {
      const d = e?.data;
      if (!d || d.room_id !== roomId) return;
      if (d.metadata?.type === "walkthrough_request" || d.metadata?.type === "walkthrough_response") {
        if (d.metadata.status === "confirmed") setWtStatus("SCHEDULED");
        else if (d.metadata.status === "denied") setWtStatus("CANCELED");
        else if (d.metadata.status === "pending") { setWtStatus("PROPOSED"); setWtProposedBy(d.sender_profile_id); }
      }
    });
    return () => { try { unsub1(); } catch(_){} try { unsub2(); } catch(_){} };
  }, [localDeal?.id, deal?.id, roomId]);

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

  // Track fully-signed from both room props AND real-time agreement updates
  const [agreementFullySigned, setAgreementFullySigned] = useState(false);
  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.LegalAgreement.subscribe((e) => {
      const d = e?.data;
      if (!d) return;
      if (d.room_id !== roomId && d.deal_id !== (deal?.id || room?.deal_id)) return;
      if (d.status === 'fully_signed') {
        setAgreementFullySigned(true);
        // Also refresh room to pick up locked/fully_signed status
        base44.entities.Room.filter({ id: roomId }).then(r => { if (r?.[0]) setLocalRoom(r[0]); }).catch(() => {});
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId, deal?.id, room?.deal_id]);

  const isSigned = agreementFullySigned || localRoom?.is_fully_signed || localRoom?.agreement_status === 'fully_signed' || localRoom?.request_status === 'locked' || room?.is_fully_signed || room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || deal?.is_fully_signed;
  const maskAddr = isAgent && !isSigned;

  const tabs = isSigned
    ? [{ id: 'details', label: 'Details', icon: Info }, { id: 'files', label: 'Files', icon: FileText }, { id: 'photos', label: 'Photos', icon: Image }, { id: 'activity', label: 'Activity', icon: Activity }]
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
      } catch (err) { 
        reportError('File upload to room failed', {
          cause: err,
          extra: { type, file_count: files.length, room_id: roomId },
        });
      }
    };
    input.click();
  };

  // Show loading skeleton while deal is being fetched (prevents stale data flash on room switch)
  if (!deal && !localDeal) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-[#E3C567] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Tab Nav */}
      <div className="rounded-[14px] p-1.5 flex gap-1.5 overflow-x-auto" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-[10px] font-medium text-sm whitespace-nowrap transition-all duration-180 ${activeTab === tab.id ? 'bg-[#E3C567] text-black' : 'text-[#808080] hover:bg-[rgba(255,255,255,0.04)] hover:text-[rgba(255,255,255,0.80)]'}`} style={activeTab === tab.id ? {} : {}}>
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
          <div className="rounded-[16px] p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <h3 className="text-2xl font-bold text-[#E3C567] mb-2">{maskAddr ? `Deal in ${[deal?.city, deal?.state].filter(Boolean).join(', ')}` : (deal?.property_address || 'Property')}</h3>
            <p className="text-sm text-[#808080] mb-3">{[deal?.city, deal?.state].filter(Boolean).join(', ')}</p>
            {isAgent ? (
              <>
                <div className="text-3xl font-bold text-[#34D399] mb-1">{(deal?.estimated_list_price || room?.estimated_list_price) ? `$${(deal?.estimated_list_price || room?.estimated_list_price).toLocaleString()}` : 'Not set'}</div>
                <p className="text-xs text-[#808080] mb-3">Estimated List Price</p>
              </>
            ) : (
              <>
                <div className="text-3xl font-bold text-[#34D399] mb-1">${(deal?.purchase_price || room?.budget || 0).toLocaleString()}</div>
                <p className="text-xs text-[#808080] mb-1">Contract Price</p>
                {deal?.estimated_list_price && deal.estimated_list_price !== deal.purchase_price && (
                  <p className="text-sm text-[#808080] mb-3">Estimated List Price: <span className="text-[#E3C567] font-semibold">${deal.estimated_list_price.toLocaleString()}</span></p>
                )}
              </>
            )}
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
              {deal?.pipeline_stage ? deal.pipeline_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'New Deal'}
            </span>
            <WalkthroughStatusLine deal={localDeal} isSigned={isSigned} externalStatus={wtStatus} />
          </div>

          {/* Property Details (left) + Key Terms (right) side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PropertyDetailsCard deal={localDeal || {}} />
            <KeyTermsPanel deal={localDeal || deal} room={localRoom} profile={profile} selectedAgentId={selectedAgentProfileId} isSigned={isSigned} />
          </div>

          {/* Agreement actions (below, full width) — always show so fully-signed state is visible */}
          <div data-agreement-panel className="rounded-[16px] p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <SimpleAgreementPanel dealId={deal?.id || room?.deal_id} roomId={roomId} profile={profile} deal={localDeal} onInvestorSigned={onInvestorSigned} selectedAgentProfileId={selectedAgentProfileId} room={localRoom} inline />
          </div>

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
          <div className="rounded-[16px] p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
            <h4 className="text-lg font-semibold mb-4" style={{ color: 'rgba(255,255,255,0.90)' }}>Deal Progress</h4>
            <div className="space-y-3">
              {PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(stage => {
                const norm = normalizeStage(localDeal?.pipeline_stage);
                const isActive = norm === stage.id;
                const isPast = stage.order < stageOrder(norm);
                const handleStageClick = async () => {
                   if (!localDeal?.id) return;

                   const currentStage = normalizeStage(localDeal.pipeline_stage);

                   // Block moving back to new_deals from connected_deals or beyond
                   if (currentStage !== 'new_deals' && stage.id === 'new_deals') {
                     toast.error("Cannot move deal back to New Deals");
                     return;
                   }

                   // Block moving out of new_deals unless agreement is fully signed
                   if (currentStage === 'new_deals' && !isSigned) {
                     toast.error("Agreement must be fully signed before moving this deal forward.");
                     return;
                   }

                   // Block moving to connected_deals or beyond unless agreement is fully signed
                   if (!isSigned && stageOrder(stage.id) >= stageOrder('connected_deals')) {
                     toast.error("Agreement must be fully signed before moving this deal forward.");
                     return;
                   }

                   await base44.functions.invoke('updateDealDocuments', { dealId: localDeal.id, pipeline_stage: stage.id });
                   toast.success(`Moved to ${stage.label}`);
                 };
                return (
                  <div key={stage.id}>
                    <button onClick={handleStageClick} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-[#141414] transition-colors cursor-pointer">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#E3C567] ring-2 ring-[#E3C567] ring-offset-2 ring-offset-[#111114]' : isPast ? 'bg-[#2D8A6E]' : 'bg-[#1F1F1F]'}`}>
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
                           wtStatus={wtStatus}
                           wtProposedBy={wtProposedBy}
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
                             // Persist to shared cache so room switches preserve the update
                             if (deal?.id && patchDealCache) {
                               patchDealCache(deal.id, patch);
                             }
                           }}
                           onOpenWalkthroughModal={() => setWtModalOpen(true)}
                           onReviewSubmitted={() => {
                             // Refresh the local deal to pick up any changes
                             setLocalDeal(prev => ({ ...prev }));
                           }}
                         />
                        {stage.id === 'connected_deals' && (
                          <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-3">
                            <p className="text-xs font-semibold text-[#FAFAFA] mb-2">Walk-through</p>
                            <InlineWalkthroughStatus deal={localDeal} room={localRoom} profile={profile} roomId={roomId} externalStatus={wtStatus} externalProposedBy={wtProposedBy} externalLoaded={wtLoaded} />
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



      {/* Files Tab — keep mounted once visited */}
      {visitedTabs.has('files') && (
        <div style={{ display: activeTab === 'files' ? 'block' : 'none' }}>
          <FilesTab deal={localDeal} room={localRoom} roomId={roomId} profile={profile} />
        </div>
      )}

      {/* Photos Tab */}
      {activeTab === 'photos' && (
        <div className="rounded-[16px] p-6" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', border: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.6)' }}>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-lg font-semibold" style={{ color: 'rgba(255,255,255,0.90)' }}>Photos</h4>
            <Button onClick={() => uploadToRoom('photo')} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-[12px]"><Plus className="w-4 h-4 mr-2" />Upload</Button>
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
                      <button onClick={() => setViewerFile({ url: p.url, name: p.name })} className="bg-[#E3C567] text-black px-4 py-2 rounded-full text-sm font-medium">View</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Activity Tab — keep mounted once visited */}
      <FileViewerModal
        open={!!viewerFile}
        onOpenChange={(open) => { if (!open) setViewerFile(null); }}
        fileUrl={viewerFile?.url}
        fileName={viewerFile?.name}
      />

      {visitedTabs.has('activity') && (
        <div style={{ display: activeTab === 'activity' ? 'block' : 'none' }}>
          <DealActivityTab dealId={deal?.id} roomId={roomId} />
        </div>
      )}
    </div>
  );
}