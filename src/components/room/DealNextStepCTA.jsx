import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { normalizeStage } from "@/components/pipelineStages";
import { validateSafeDocument } from "@/components/utils/fileValidation";
import { toast } from "sonner";
import {
  FileSignature, Calendar, Upload, ArrowRight, CheckCircle2,
  Clock, Loader2, XCircle, Star, FileCheck
} from "lucide-react";

export default function DealNextStepCTA({ deal, room, profile, roomId, onDealUpdate, onOpenWalkthroughModal, inline = false }) {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [apptStatus, setApptStatus] = useState(null);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  const isInvestor = profile?.user_role === 'investor' || isAdmin;
  const isAgent = !isAdmin && profile?.user_role === 'agent';
  const stage = normalizeStage(deal?.pipeline_stage);
  const isSigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || room?.is_fully_signed === true;

  // Load walkthrough appointment status
  useEffect(() => {
    if (!deal?.id) return;
    base44.entities.DealAppointments.filter({ dealId: deal.id }).then(rows => {
      setApptStatus(rows?.[0]?.walkthrough?.status || null);
    }).catch(() => {});

    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === deal.id && e.data.walkthrough?.status) {
        setApptStatus(e.data.walkthrough.status);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  useEffect(() => {
    if (!roomId) return;
    const unsub = base44.entities.Message.subscribe(e => {
      const d = e?.data;
      if (!d || d.room_id !== roomId) return;
      if (d.metadata?.type === "walkthrough_request" || d.metadata?.type === "walkthrough_response") {
        if (d.metadata.status === "confirmed") setApptStatus("SCHEDULED");
        else if (d.metadata.status === "denied") setApptStatus("CANCELED");
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [roomId]);

  const triggerUpload = (docKey) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xls,.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const v = validateSafeDocument(file);
      if (!v.valid) { toast.error(v.error); return; }
      setUploading(true);
      toast.info('Uploading document...');
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const docEntry = { url: file_url, name: file.name, uploaded_at: new Date().toISOString(), uploaded_by: profile?.id };

        await base44.functions.invoke('updateDealDocuments', {
          dealId: deal.id,
          documents: { [docKey]: docEntry }
        });

        // Optimistic local update
        onDealUpdate?.({ documents: { ...(deal?.documents || {}), [docKey]: docEntry } });
        toast.success('Document uploaded');
      } catch (err) {
        toast.error('Upload failed — please try again');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const updateStage = async (newStage) => {
    if (!deal?.id) return;
    setUpdatingStage(true);
    try {
      await base44.functions.invoke('updateDealDocuments', { dealId: deal.id, pipeline_stage: newStage });
      toast.success('Deal updated');
      onDealUpdate?.({ pipeline_stage: newStage });
      if (newStage === 'completed') {
        const agentId = deal.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0];
        if (agentId && isInvestor) {
          navigate(`${createPageUrl("RateAgent")}?dealId=${deal.id}&agentProfileId=${agentId}&returnTo=Pipeline`);
        }
      }
    } catch (_) {
      toast.error('Failed to update');
    } finally {
      setUpdatingStage(false);
      setShowClosePrompt(false);
    }
  };

  // Determine CTA
  const wtScheduled = deal?.walkthrough_scheduled === true;
  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date;
  const hasWalkthrough = wtScheduled && (wtDate || wtSlots.length > 0);
  const wtStatus = apptStatus || (hasWalkthrough ? 'PROPOSED' : 'NOT_SET');

  const hasCma = !!(deal?.documents?.cma?.url);
  const hasBuyerContract = !!(deal?.documents?.buyer_contract?.url);

  let cta = null;

  if (stage === 'new_deals') {
    if (!isSigned) {
      cta = { type: 'action', icon: FileSignature, label: 'Sign Agreement', description: 'Review and sign the agreement to move this deal forward.', onClick: () => { const el = document.querySelector('[data-agreement-panel]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
    } else {
      cta = { type: 'waiting', icon: Clock, label: 'Waiting for Counterparty Signature', description: 'The other party needs to sign the agreement to proceed.' };
    }
  } else if (stage === 'connected_deals') {
    if (!hasWalkthrough && wtStatus === 'NOT_SET') {
      if (isInvestor) {
        cta = { type: 'action', icon: Calendar, label: 'Schedule Walkthrough', description: 'Propose walkthrough dates for the agent.', onClick: () => onOpenWalkthroughModal?.() };
      } else {
        cta = { type: 'waiting', icon: Clock, label: 'Waiting for Walkthrough', description: 'The investor hasn\'t scheduled a walkthrough yet.' };
      }
    } else if (wtStatus === 'PROPOSED') {
      if (isAgent) {
        cta = { type: 'action', icon: Calendar, label: 'Confirm Walkthrough', description: 'Review and confirm the proposed walkthrough dates.', onClick: () => { const el = document.querySelector('[data-walkthrough-panel]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } };
      } else {
        cta = { type: 'waiting', icon: Clock, label: 'Walkthrough Proposed', description: 'Awaiting agent confirmation of the walkthrough.' };
      }
    } else if (wtStatus === 'SCHEDULED' || wtStatus === 'COMPLETED') {
      if (!hasCma) {
        if (isAgent) {
          cta = { type: 'action', icon: Upload, label: 'Upload CMA', description: 'Upload a Comparative Market Analysis for this property.', onClick: () => triggerUpload('cma') };
        } else {
          cta = { type: 'waiting', icon: Clock, label: 'Waiting for CMA', description: 'The agent is preparing the Comparative Market Analysis.' };
        }
      } else {
        cta = { type: 'action', icon: CheckCircle2, label: 'Has this property been listed?', description: 'CMA is uploaded. Confirm when the property has been listed to move forward.', onClick: () => updateStage('active_listings') };
      }
    }
  } else if (stage === 'active_listings') {
    if (!hasBuyerContract) {
      if (isAgent) {
        cta = { type: 'action', icon: Upload, label: "Upload Buyer's Contract", description: 'Upload the buyer\'s purchase contract to proceed.', onClick: () => triggerUpload('buyer_contract') };
      } else {
        cta = { type: 'waiting', icon: Clock, label: "Waiting for Buyer's Contract", description: 'The agent will upload the buyer\'s contract when ready.' };
      }
    } else {
      cta = { type: 'action', icon: ArrowRight, label: 'Move to Closing', description: 'Buyer\'s contract is in. Move this deal to closing.', onClick: () => updateStage('in_closing') };
    }
  } else if (stage === 'in_closing') {
    if (!showClosePrompt) {
      cta = { type: 'action', icon: CheckCircle2, label: 'Did This Deal Close?', description: 'Confirm whether this transaction closed successfully.', onClick: () => setShowClosePrompt(true) };
    }
  } else if (stage === 'completed') {
    cta = { type: 'complete', icon: CheckCircle2, label: 'Deal Complete ✓', description: 'This deal has been successfully closed.' };
  } else if (stage === 'canceled') {
    cta = { type: 'canceled', icon: XCircle, label: 'Deal Canceled', description: 'This deal has been canceled.' };
  }

  // Build completed milestones for connected_deals stage
  const completedMilestones = [];
  if (stage === 'connected_deals') {
    if (wtStatus === 'SCHEDULED' || wtStatus === 'COMPLETED') {
      completedMilestones.push({ icon: Calendar, label: 'Walkthrough Scheduled' });
    } else if (wtStatus === 'PROPOSED' || hasWalkthrough) {
      completedMilestones.push({ icon: Clock, label: 'Walkthrough Proposed', pending: true });
    }
    if (hasCma) {
      completedMilestones.push({ icon: FileCheck, label: 'CMA Uploaded' });
    }
  }

  if (!cta && !showClosePrompt && completedMilestones.length === 0) return null;

  // Close prompt UI
  const closePromptUI = (
    <div className="space-y-3">
      <p className={`font-medium text-[#FAFAFA] ${inline ? 'text-sm' : 'text-lg'}`}>Did this deal close?</p>
      {!inline && <p className="text-sm text-[#808080]">Confirm the outcome of this transaction.</p>}
      <div className="flex gap-2">
        <Button onClick={() => updateStage('completed')} disabled={updatingStage} size={inline ? 'sm' : 'default'} className={`flex-1 bg-[#10B981] hover:bg-[#059669] text-white rounded-full ${inline ? 'text-xs' : 'font-semibold'}`}>
          {updatingStage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
          Yes, Closed
        </Button>
        <Button onClick={() => updateStage('canceled')} disabled={updatingStage} size={inline ? 'sm' : 'default'} variant="outline" className={`flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full ${inline ? 'text-xs' : 'font-semibold'}`}>
          {updatingStage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
          No, Canceled
        </Button>
      </div>
      <button onClick={() => setShowClosePrompt(false)} className="text-xs text-[#808080] hover:text-[#FAFAFA]">Go back</button>
    </div>
  );

  const renderCta = () => {
    if (showClosePrompt) return closePromptUI;

    if (cta.type === 'waiting') {
      return (
        <div className="flex items-center gap-3">
          <Clock className={`${inline ? 'w-4 h-4' : 'w-6 h-6'} text-[#808080] flex-shrink-0`} />
          <div>
            <p className={`font-medium text-[#808080] ${inline ? 'text-sm' : 'text-base'}`}>{cta.label}</p>
            <p className={`text-[#666] ${inline ? 'text-xs' : 'text-sm'}`}>{cta.description}</p>
          </div>
        </div>
      );
    }

    if (cta.type === 'complete') {
      return (
        <div className="flex items-center gap-3">
          <CheckCircle2 className={`${inline ? 'w-4 h-4' : 'w-6 h-6'} text-[#10B981] flex-shrink-0`} />
          <div className="flex-1">
            <p className={`font-medium text-[#10B981] ${inline ? 'text-sm' : 'text-base'}`}>{cta.label}</p>
            {isInvestor && (
              <button
                onClick={() => {
                  const agentId = deal?.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0];
                  if (agentId) navigate(`${createPageUrl("RateAgent")}?dealId=${deal.id}&agentProfileId=${agentId}&returnTo=Pipeline`);
                }}
                className="text-xs text-[#E3C567] hover:text-[#EDD89F] mt-1 inline-flex items-center gap-1"
              >
                <Star className="w-3 h-3" /> Leave a Review
              </button>
            )}
          </div>
        </div>
      );
    }

    if (cta.type === 'canceled') {
      return (
        <div className="flex items-center gap-3">
          <XCircle className={`${inline ? 'w-4 h-4' : 'w-6 h-6'} text-red-400 flex-shrink-0`} />
          <p className={`font-medium text-red-400 ${inline ? 'text-sm' : 'text-base'}`}>{cta.label}</p>
        </div>
      );
    }

    // Action type
    return (
      <div className="space-y-3">
        {!inline && (
          <h4 className="text-base font-semibold text-[#FAFAFA]">Next Step</h4>
        )}
        <p className={`text-[#808080] ${inline ? 'text-xs' : 'text-sm'}`}>{cta.description}</p>
        <Button
          onClick={cta.onClick}
          disabled={uploading || updatingStage}
          size={inline ? 'sm' : 'default'}
          className={`w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold ${inline ? 'text-xs h-9' : 'h-11'}`}
        >
          {(uploading || updatingStage) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <cta.icon className="w-4 h-4 mr-2" />}
          {cta.label}
        </Button>
      </div>
    );
  };

  return (
    <div className={`${inline ? 'bg-[#141414] border border-[#1F1F1F] rounded-xl p-4' : 'bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6'}`}>
      {completedMilestones.length > 0 && (
        <div className={`space-y-1.5 ${cta || showClosePrompt ? 'mb-3 pb-3 border-b border-[#1F1F1F]' : ''}`}>
          {completedMilestones.map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <m.icon className={`w-3.5 h-3.5 flex-shrink-0 ${m.pending ? 'text-[#F59E0B]' : 'text-[#10B981]'}`} />
              <span className={`text-xs font-medium ${m.pending ? 'text-[#F59E0B]' : 'text-[#10B981]'}`}>{m.label}</span>
            </div>
          ))}
        </div>
      )}
      {(cta || showClosePrompt) && renderCta()}
    </div>
  );
}