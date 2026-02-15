import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Info, Shield, FileText, Image, User, Plus, Download, Activity } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import SimpleAgreementPanel from "@/components/SimpleAgreementPanel";
import KeyTermsPanel from "@/components/room/KeyTermsPanel";
import PropertyDetailsCard from "@/components/PropertyDetailsCard";
import WalkthroughPanel from "@/components/room/WalkthroughPanel.jsx";
import { PIPELINE_STAGES, normalizeStage, stageOrder } from "@/components/pipelineStages";
import FilesTab from "@/components/room/FilesTab.jsx";
import { validateImage, validateSafeDocument } from "@/components/utils/fileValidation";
import DealActivityTab from "@/components/room/DealActivityTab.jsx";

export default function DealBoard({ deal, room, profile, roomId, onInvestorSigned, selectedAgentProfileId }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [localRoom, setLocalRoom] = useState(room);
  const [messagePhotos, setMessagePhotos] = useState([]);
  useEffect(() => { if (room) setLocalRoom(room); }, [room]);

  // Load photos shared via chat messages
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const msgs = await base44.entities.Message.filter({ room_id: roomId }, "created_date");
      const photos = (msgs || [])
        .filter(m => m?.metadata?.file_url && (m?.metadata?.type === 'photo' || (m?.metadata?.file_type || '').startsWith('image/')))
        .map(m => ({
          name: m.metadata.file_name || 'Photo',
          url: m.metadata.file_url,
          uploaded_by: m.sender_profile_id,
          uploaded_at: m.created_date,
          source: 'message'
        }));
      setMessagePhotos(photos);
    })();
  }, [roomId]);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  const isInvestor = profile?.user_role === 'investor' || isAdmin;
  const isAgent = !isAdmin && profile?.user_role === 'agent';
  const isSigned = room?.is_fully_signed || room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || deal?.is_fully_signed;
  const maskAddr = isAgent && !isSigned;

  const tabs = isSigned
    ? [{ id: 'details', label: 'Details', icon: Info }, { id: 'agreement', label: 'Agreement', icon: Shield }, { id: 'files', label: 'Files', icon: FileText }, { id: 'photos', label: 'Photos', icon: Image }, { id: 'activity', label: 'Activity', icon: Activity }]
    : [{ id: 'details', label: 'Details', icon: Info }];

  // Open agreement tab if URL param
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    if (p.get('tab') === 'agreement') setActiveTab('agreement');
  }, []);

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
            <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-[#E3C567]/20 text-[#E3C567] border border-[#E3C567]/30">
              {deal?.pipeline_stage ? deal.pipeline_stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 'New Deal'}
            </span>
          </div>
          {/* Deal Progress */}
          <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
            <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Deal Progress</h4>
            <div className="space-y-3">
              {PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(stage => {
                const norm = normalizeStage(deal?.pipeline_stage);
                const isActive = norm === stage.id;
                const isPast = stage.order < stageOrder(norm);
                const handleStageClick = async () => {
                  if (!deal?.id) return;
                  await base44.entities.Deal.update(deal.id, { pipeline_stage: stage.id });
                  toast.success(`Moved to ${stage.label}`);
                  // Redirect to rate agent when moved to completed or canceled
                  if (stage.id === 'completed' || stage.id === 'canceled') {
                    const agentId = deal.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0];
                    if (agentId) {
                      navigate(`${createPageUrl("RateAgent")}?dealId=${deal.id}&agentProfileId=${agentId}&returnTo=Pipeline`);
                    }
                  }
                };
                return (
                  <button key={stage.id} onClick={handleStageClick} className="flex items-center gap-3 w-full text-left p-2 rounded-lg hover:bg-[#141414] transition-colors cursor-pointer">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-[#E3C567] ring-2 ring-[#E3C567] ring-offset-2 ring-offset-black' : isPast ? 'bg-[#34D399]' : 'bg-[#1F1F1F]'}`}>
                      <span className="text-sm font-bold text-white">{isPast ? '✓' : stage.order}</span>
                    </div>
                    <div><p className={`text-sm font-medium ${isActive ? 'text-[#FAFAFA]' : isPast ? 'text-[#808080]' : 'text-[#666]'}`}>{stage.label}</p>{isActive && <p className="text-xs text-[#E3C567]">Current</p>}</div>
                  </button>
                );
              })}
            </div>
          </div>
          <WalkthroughPanel deal={deal} room={room} profile={profile} roomId={roomId} />
          <PropertyDetailsCard deal={deal || {}} />
        </div>
      )}

      {/* Agreement Tab */}
      {activeTab === 'agreement' && (
        <div className="space-y-6">
          <SimpleAgreementPanel dealId={deal?.id || room?.deal_id} roomId={roomId} profile={profile} deal={deal} onInvestorSigned={onInvestorSigned} selectedAgentProfileId={selectedAgentProfileId} />
          <KeyTermsPanel deal={deal} room={localRoom} profile={profile} selectedAgentId={selectedAgentProfileId} />
        </div>
      )}

      {/* Files Tab */}
      {activeTab === 'files' && (
        <FilesTab deal={deal} room={localRoom} roomId={roomId} profile={profile} />
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

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <DealActivityTab dealId={deal?.id} roomId={roomId} />
      )}
    </div>
  );
}