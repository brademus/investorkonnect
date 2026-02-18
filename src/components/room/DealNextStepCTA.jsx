import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { normalizeStage } from "@/components/pipelineStages";
import { validateSafeDocument } from "@/components/utils/fileValidation";
import { toast } from "sonner";
import {
  FileSignature, Calendar, Upload, ArrowRight, CheckCircle2,
  Clock, Loader2, XCircle, Star
} from "lucide-react";

/**
 * Smart Next-Step CTA — shows the single most important action the user should take.
 */
export default function DealNextStepCTA({ deal, room, profile, roomId, onDealUpdate, onOpenWalkthroughModal, inline = false }) {
  const navigate = useNavigate();
  const [uploading, setUploading] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [showClosePrompt, setShowClosePrompt] = useState(false);
  const [apptStatus, setApptStatus] = useState(null);
  const [apptLoaded, setApptLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const [uploadDocKey, setUploadDocKey] = useState(null);

  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  const isInvestor = profile?.user_role === 'investor' || isAdmin;
  const isAgent = !isAdmin && profile?.user_role === 'agent';
  const stage = normalizeStage(deal?.pipeline_stage);
  const isSigned = room?.agreement_status === 'fully_signed' || room?.request_status === 'locked' || room?.is_fully_signed === true;

  // Load walkthrough appointment status + subscribe to real-time changes
  useEffect(() => {
    if (!deal?.id) return;
    base44.entities.DealAppointments.filter({ dealId: deal.id }).then(rows => {
      setApptStatus(rows?.[0]?.walkthrough?.status || null);
      setApptLoaded(true);
    }).catch(() => setApptLoaded(true));

    const unsub = base44.entities.DealAppointments.subscribe(e => {
      if (e?.data?.dealId === deal.id && e.data.walkthrough?.status) {
        setApptStatus(e.data.walkthrough.status);
      }
    });
    return () => { try { unsub(); } catch (_) {} };
  }, [deal?.id]);

  // Also listen for walkthrough response messages
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

  // File upload handler
  const triggerUpload = (docKey) => {
    setUploadDocKey(docKey);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadDocKey) return;
    const v = validateSafeDocument(file);
    if (!v.valid) { toast.error(v.error); return; }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const docs = { ...(deal?.documents || {}) };
      docs[uploadDocKey] = { url: file_url, name: file.name, uploaded_at: new Date().toISOString(), uploaded_by: profile?.id };
      await base44.entities.Deal.update(deal.id, { documents: docs });
      // Also add to room files
      if (roomId) {
        const roomFiles = [...(room?.files || []), { name: file.name, url: file_url, uploaded_by: profile?.id, uploaded_by_name: profile?.full_name, uploaded_at: new Date().toISOString() }];
        await base44.entities.Room.update(roomId, { files: roomFiles });
      }
      toast.success('Document uploaded');
      onDealUpdate?.();
    } catch (_) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      setUploadDocKey(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateStage = async (newStage) => {
    if (!deal?.id) return;
    setUpdatingStage(true);
    try {
      await base44.entities.Deal.update(deal.id, { pipeline_stage: newStage });
      toast.success('Deal updated');
      onDealUpdate?.();
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

  // --- Determine what to render ---
  const wtScheduled = deal?.walkthrough_scheduled === true;
  const wtSlots = deal?.walkthrough_slots?.filter(s => s.date && s.date.length >= 8) || [];
  const wtDate = deal?.walkthrough_date;
  const hasWalkthrough = wtScheduled && (wtDate || wtSlots.length > 0);
  const wtStatus = apptStatus || (hasWalkthrough ? 'PROPOSED' : 'NOT_SET');

  const hasCma = !!(deal?.documents?.cma?.url);
  const hasListingAgreement = !!(deal?.documents?.listing_agreement?.url);
  const hasBuyerContract = !!(deal?.documents?.buyer_contract?.url);

  let cta = null;

  if (stage === 'new_deals') {
    if (!isSigned) {
      cta = {
        type: 'action',
        icon: FileSignature,
        label: 'Sign Agreement',
        description: 'Review and sign the agreement to move this deal forward.',
        onClick: () => {
          const el = document.querySelector('[data-agreement-panel]');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      };
    } else {
      cta = {
        type: 'waiting',
        icon: Clock,
        label: 'Waiting for Counterparty Signature',
        description: 'The other party needs to sign the agreement to proceed.'
      };
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
        cta = {
          type: 'action', icon: Calendar, label: 'Confirm Walkthrough',
          description: 'Review and confirm the proposed walkthrough dates.',
          onClick: () => {
            const el = document.querySelector('[data-walkthrough-panel]');
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        };
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
        // CMA uploaded — ask if property has been listed
        cta = {
          type: 'action', icon: ArrowRight, label: 'Has This Property Been Listed?',
          description: 'CMA uploaded. Confirm this property is now listed to move it forward.',
          onClick: () => updateStage('active_listings')
        };
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
      cta = {
        type: 'action', icon: CheckCircle2, label: 'Did This Deal Close?',
        description: 'Confirm whether this transaction closed successfully.',
        onClick: () => setShowClosePrompt(true)
      };
    }
  } else if (stage === 'completed') {
    cta = { type: 'complete', icon: CheckCircle2, label: 'Deal Complete ✓', description: 'This deal has been successfully closed.' };
  } else if (stage === 'canceled') {
    cta = { type: 'canceled', icon: XCircle, label: 'Deal Canceled', description: 'This deal has been canceled.' };
  }

  if (!cta && !showClosePrompt) return null;

  // --- Inline (compact) rendering for inside the stepper ---
  if (inline) {
    return (
      <div className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4">
        <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

        {showClosePrompt ? (
          <div className="space-y-3">
            <p className="text-sm font-medium text-[#FAFAFA]">Did this deal close?</p>
            <div className="flex gap-2">
              <Button onClick={() => updateStage('completed')} disabled={updatingStage} size="sm" className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white rounded-full text-xs">
                {updatingStage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                Yes, Closed
              </Button>
              <Button onClick={() => updateStage('canceled')} disabled={updatingStage} size="sm" variant="outline" className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full text-xs">
                {updatingStage ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
                No, Canceled
              </Button>
            </div>
            <button onClick={() => setShowClosePrompt(false)} className="text-xs text-[#808080] hover:text-[#FAFAFA]">Go back</button>
          </div>
        ) : cta.type === 'waiting' ? (
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-[#808080] flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-[#808080]">{cta.label}</p>
              <p className="text-xs text-[#666]">{cta.description}</p>
            </div>
          </div>
        ) : cta.type === 'complete' ? (
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-[#10B981]">{cta.label}</p>
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
        ) : cta.type === 'canceled' ? (
          <div className="flex items-center gap-3">
            <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm font-medium text-red-400">{cta.label}</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-[#808080]">{cta.description}</p>
            <Button
              onClick={cta.onClick}
              disabled={uploading || updatingStage}
              size="sm"
              className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold text-xs h-9"
            >
              {(uploading || updatingStage) ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <cta.icon className="w-3 h-3 mr-1" />}
              {cta.label}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // --- Full-size standalone rendering ---
  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <input ref={fileInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={handleFileChange} />

      {showClosePrompt ? (
        <div className="space-y-4">
          <h4 className="text-lg font-semibold text-[#FAFAFA]">Did this deal close?</h4>
          <p className="text-sm text-[#808080]">Confirm the outcome of this transaction.</p>
          <div className="flex gap-3">
            <Button
              onClick={() => updateStage('completed')}
              disabled={updatingStage}
              className="flex-1 bg-[#10B981] hover:bg-[#059669] text-white rounded-full font-semibold"
            >
              {updatingStage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Yes, Closed
            </Button>
            <Button
              onClick={() => updateStage('canceled')}
              disabled={updatingStage}
              variant="outline"
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 rounded-full font-semibold"
            >
              {updatingStage ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
              No, Canceled
            </Button>
          </div>
          <button onClick={() => setShowClosePrompt(false)} className="text-xs text-[#808080] hover:text-[#FAFAFA] transition-colors">
            Go back
          </button>
        </div>
      ) : cta.type === 'waiting' ? (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#1F1F1F] flex items-center justify-center flex-shrink-0">
            <cta.icon className="w-6 h-6 text-[#808080]" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-[#FAFAFA] mb-1">{cta.label}</h4>
            <p className="text-sm text-[#808080]">{cta.description}</p>
          </div>
        </div>
      ) : cta.type === 'complete' ? (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#10B981]/15 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-6 h-6 text-[#10B981]" />
          </div>
          <div className="flex-1">
            <h4 className="text-base font-semibold text-[#10B981] mb-1">{cta.label}</h4>
            <p className="text-sm text-[#808080]">{cta.description}</p>
            {isInvestor && (
              <button
                onClick={() => {
                  const agentId = deal?.locked_agent_id || room?.locked_agent_id || room?.agent_ids?.[0];
                  if (agentId) navigate(`${createPageUrl("RateAgent")}?dealId=${deal.id}&agentProfileId=${agentId}&returnTo=Pipeline`);
                }}
                className="mt-3 inline-flex items-center gap-2 text-sm text-[#E3C567] hover:text-[#EDD89F] transition-colors"
              >
                <Star className="w-4 h-4" /> Leave a Review
              </button>
            )}
          </div>
        </div>
      ) : cta.type === 'canceled' ? (
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
            <XCircle className="w-6 h-6 text-red-400" />
          </div>
          <div>
            <h4 className="text-base font-semibold text-red-400 mb-1">{cta.label}</h4>
            <p className="text-sm text-[#808080]">{cta.description}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-[#E3C567]/15 flex items-center justify-center flex-shrink-0">
              <cta.icon className="w-6 h-6 text-[#E3C567]" />
            </div>
            <div className="flex-1">
              <h4 className="text-base font-semibold text-[#FAFAFA] mb-1">Next Step</h4>
              <p className="text-sm text-[#808080]">{cta.description}</p>
            </div>
          </div>
          <Button
            onClick={cta.onClick}
            disabled={uploading || updatingStage}
            className="w-full bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold h-11"
          >
            {(uploading || updatingStage) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <cta.icon className="w-4 h-4 mr-2" />}
            {cta.label}
          </Button>
        </div>
      )}
    </div>
  );
}