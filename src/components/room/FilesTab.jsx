import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { FileText, Download, Upload, Lock, CheckCircle2, Plus } from "lucide-react";
import { toast } from "sonner";
import { resolveDealDocuments } from "@/components/utils/dealDocuments";
import { validateSafeDocument } from "@/components/utils/fileValidation";

function DocRow({ label, url, filename, verified, available, onUpload }) {
  const hasFile = !!url;
  return (
    <div className={`flex items-center gap-3 p-4 rounded-xl border transition-colors ${hasFile ? 'bg-[#141414] border-[#1F1F1F]' : 'bg-[#0A0A0A] border-[#1A1A1A] opacity-60'}`}>
      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${hasFile ? 'bg-[#E3C567]/15' : 'bg-[#1F1F1F]'}`}>
        {hasFile ? <FileText className="w-5 h-5 text-[#E3C567]" /> : <Lock className="w-5 h-5 text-[#808080]" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${hasFile ? 'text-[#FAFAFA]' : 'text-[#808080]'}`}>{label}</p>
        {hasFile && filename && <p className="text-xs text-[#808080] truncate">{filename}</p>}
        {hasFile && verified && (
          <span className="inline-flex items-center gap-1 text-xs text-[#34D399] mt-0.5"><CheckCircle2 className="w-3 h-3" />Verified</span>
        )}
      </div>
      {hasFile ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#E3C567] text-black rounded-full hover:bg-[#EDD89F] transition-colors">
          <Download className="w-3 h-3" />Download
        </a>
      ) : (
        <Button onClick={onUpload} variant="outline" size="sm" className="rounded-full border-[#1F1F1F] text-[#808080] hover:border-[#E3C567] hover:text-[#E3C567]">
          <Upload className="w-3 h-3 mr-1.5" />Upload
        </Button>
      )}
    </div>
  );
}

export default function FilesTab({ deal, room, roomId, profile }) {
  const [localRoom, setLocalRoom] = useState(room);
  const [messageFiles, setMessageFiles] = useState([]);

  useEffect(() => { if (room) setLocalRoom(room); }, [room]);

  // Load file attachments from messages
  useEffect(() => {
    if (!roomId) return;
    (async () => {
      const msgs = await base44.entities.Message.filter({ room_id: roomId }, "created_date");
      const files = (msgs || [])
        .filter(m => m?.metadata?.file_url)
        .map(m => ({
          name: m.metadata.file_name || 'Attachment',
          url: m.metadata.file_url,
          uploaded_by_name: m.sender_profile_id,
          uploaded_at: m.created_date,
          type: m.metadata.file_type,
          source: 'message'
        }));
      setMessageFiles(files);
    })();
  }, [roomId]);

  const resolved = resolveDealDocuments({ deal: deal || {}, room: localRoom || {} });

  // Fetch the agreement's signed/final PDF URL
  const [agreementUrl, setAgreementUrl] = useState(null);
  useEffect(() => {
    const rid = roomId || localRoom?.id;
    const did = deal?.id || localRoom?.deal_id;
    if (!rid && !did) return;
    (async () => {
      const agrs = await base44.entities.LegalAgreement.filter(
        rid ? { room_id: rid } : { deal_id: did }, '-created_date', 5
      );
      const active = (agrs || []).find(a => a.status !== 'voided' && a.status !== 'superseded');
      if (active) {
        setAgreementUrl(active.signed_pdf_url || active.final_pdf_url || active.pdf_file_url || active.docusign_pdf_url);
      }
    })();
  }, [roomId, localRoom?.id, deal?.id]);

  const sellerContractUrl = resolved.sellerContract?.url;
  const internalAgreementUrl = agreementUrl || resolved.internalAgreement?.urlSignedPdf || resolved.internalAgreement?.urlDraft;
  const listingAgreementUrl = resolved.listingAgreement?.url;
  // Buyer's contract from deal.documents
  const buyerContractUrl = deal?.documents?.buyer_contract?.url || deal?.documents?.buyer_contract?.file_url;

  const uploadDocToRoom = async (docKey) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const v = validateSafeDocument(file);
      if (!v.valid) { toast.error(v.error); return; }
      toast.info('Uploading...');
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        // Save to deal.documents under the correct key
        const existingDocs = deal?.documents || {};
        existingDocs[docKey] = { url: file_url, name: file.name, uploaded_at: new Date().toISOString(), uploaded_by: profile?.id };
        await base44.entities.Deal.update(deal.id, { documents: existingDocs });
        toast.success('Document uploaded');
        // Also add to room files for shared visibility
        const roomFiles = [...(localRoom?.files || []), { name: file.name, url: file_url, uploaded_by: profile?.id, uploaded_by_name: profile?.full_name, uploaded_at: new Date().toISOString() }];
        await base44.entities.Room.update(roomId, { files: roomFiles });
        setLocalRoom(prev => prev ? { ...prev, files: roomFiles } : prev);
      } catch (_) { toast.error('Upload failed'); }
    };
    input.click();
  };

  const uploadGenericFile = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const v = validateSafeDocument(file);
      if (!v.valid) { toast.error(v.error); return; }
      toast.info('Uploading...');
      try {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        const roomFiles = [...(localRoom?.files || []), { name: file.name, url: file_url, uploaded_by: profile?.id, uploaded_by_name: profile?.full_name || profile?.email, uploaded_at: new Date().toISOString(), size: file.size, type: file.type }];
        await base44.entities.Room.update(roomId, { files: roomFiles });
        setLocalRoom(prev => prev ? { ...prev, files: roomFiles } : prev);
        toast.success('File uploaded');
      } catch (_) { toast.error('Upload failed'); }
    };
    input.click();
  };

  // Build shared files list: internal agreement, seller contract, room files, message files — deduped
  const sharedFiles = [];
  const seenUrls = new Set();
  const addShared = (name, url, source) => {
    if (url && !seenUrls.has(url)) {
      seenUrls.add(url);
      sharedFiles.push({ name, url, source });
    }
  };
  addShared('Internal Agreement', internalAgreementUrl, 'system');
  addShared("Seller's Contract", sellerContractUrl, 'system');
  (localRoom?.files || []).forEach(f => addShared(f.name, f.url, f.uploaded_by_name || 'User'));
  messageFiles.forEach(f => addShared(f.name, f.url, 'Message'));

  return (
    <div className="space-y-6">
      {/* Required Documents Panel */}
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
        <h4 className="text-lg font-semibold text-[#FAFAFA] mb-5">Required Documents</h4>
        <div className="space-y-3">
          <DocRow
            label="Seller's Contract"
            url={sellerContractUrl}
            filename={resolved.sellerContract?.filename || 'Purchase Contract'}
            verified={resolved.sellerContract?.verified}
            available={!!sellerContractUrl}
          />
          <DocRow
            label="Internal Agreement (IOA)"
            url={internalAgreementUrl}
            filename={resolved.internalAgreement?.filename || 'Legal Agreement'}
            verified={true}
            available={!!internalAgreementUrl}
          />
          <DocRow
            label="Listing Agreement"
            url={listingAgreementUrl}
            filename={resolved.listingAgreement?.filename}
            available={!!listingAgreementUrl}
            onUpload={() => uploadDocToRoom('listing_agreement')}
          />
          <DocRow
            label="Buyer's Contract"
            url={buyerContractUrl}
            filename={deal?.documents?.buyer_contract?.name}
            available={!!buyerContractUrl}
            onUpload={() => uploadDocToRoom('buyer_contract')}
          />
        </div>
      </div>

      {/* Shared Files Panel */}
      <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h4 className="text-lg font-semibold text-[#FAFAFA]">Shared Files</h4>
          <Button onClick={uploadGenericFile} className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs">
            <Plus className="w-4 h-4 mr-1.5" />Upload File
          </Button>
        </div>
        {sharedFiles.length === 0 ? (
          <p className="text-sm text-[#808080] text-center py-8">No shared files yet</p>
        ) : (
          <div className="space-y-2">
            {sharedFiles.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-[#141414] rounded-lg border border-[#1F1F1F]">
                <FileText className="w-5 h-5 text-[#E3C567] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[#FAFAFA] truncate">{f.name}</p>
                  <p className="text-xs text-[#808080]">{f.source}</p>
                </div>
                <a href={f.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#E3C567] text-black rounded-full hover:bg-[#EDD89F] transition-colors">
                  <Download className="w-3 h-3" />Download
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}