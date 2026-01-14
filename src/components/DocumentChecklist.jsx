import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { FileText, CheckCircle, Upload, AlertCircle, Download } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { validatePDF } from "@/components/utils/fileValidation";
import { toast } from "sonner";
import { resolveDealDocuments } from "@/components/utils/dealDocuments";

const REQUIRED_DOCUMENTS = [
  { 
    key: 'purchase_contract', 
    label: 'Seller Contract',
    description: 'Initial contract used for verification',
    uploadedBy: 'investor'
  },
  { 
    key: 'operating_agreement', 
    label: 'Internal Agreement',
    description: 'Internal investor-agent agreement',
    uploadedBy: 'both'
  },
  { 
    key: 'listing_agreement', 
    label: 'Listing Agreement',
    description: "Agent's listing agreement from brokerage",
    uploadedBy: 'agent'
  },
  { 
    key: 'buyer_contract', 
    label: 'Buyer Contract',
    description: 'Final buyer representation agreement',
    uploadedBy: 'both'
  }
];

export default function DocumentChecklist({ deal, room, userRole, onUpdate }) {
  const [uploading, setUploading] = useState(null);
  const [internalAgreementFile, setInternalAgreementFile] = useState(null);

  const documents = deal?.documents || {};
  const resolved = resolveDealDocuments({ deal, room });
  const isWorkingTogether = (
    room?.agreement_status === 'fully_signed' ||
    room?.is_fully_signed === true ||
    deal?.is_fully_signed === true
  );

  // Always check the legal agreement; if fully signed, mirror the signed PDF into Deal.documents and UI
  useEffect(() => {
    if (!deal?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await base44.functions.invoke('getLegalAgreement', { deal_id: deal.id });
        const payload = res?.data || res;
        const ag = payload?.agreement || payload; // normalize shape
        const isSigned = ag?.status === 'fully_signed' || !!(ag?.signed_pdf_url || ag?.final_pdf_url || ag?.docusign_pdf_url || ag?.pdf_file_url);
        if (!isSigned || cancelled) return;

        const url = ag?.signed_pdf_url || ag?.final_pdf_url || ag?.docusign_pdf_url || ag?.pdf_file_url;
        const filename = ag?.filename || 'internal-agreement.pdf';
        const uploaded_at = ag?.updated_at || ag?.completed_at || ag?.investor_signed_at || ag?.agent_signed_at || new Date().toISOString();

        // Update local UI state so it shows green & downloadable immediately
        setInternalAgreementFile({ url, filename, uploaded_at });

        // Persist to Deal.documents so Shared Files and other tabs can pick it up
        const docs = deal?.documents || {};
        const currentUrl = docs.operating_agreement?.file_url || docs.internal_agreement?.file_url || docs.operating_agreement?.url || docs.internal_agreement?.url;
        if (!currentUrl || currentUrl !== url) {
          const updatedDocs = {
            ...docs,
            operating_agreement: {
              ...(docs.operating_agreement || {}),
              file_url: url,
              filename,
              uploaded_at
            },
            internal_agreement: {
              ...(docs.internal_agreement || {}),
              file_url: url,
              filename,
              uploaded_at
            }
          };
          await base44.entities.Deal.update(deal.id, { documents: updatedDocs });
          if (onUpdate) onUpdate();
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, [deal?.id]);

  // Fallback for legacy/current accounts: derive from deal-level fields if present
  useEffect(() => {
    if (internalAgreementFile) return;
    const legacyUrl =
      deal?.internal_agreement_signed_url ||
      deal?.final_pdf_url ||
      deal?.docusign_pdf_url ||
      deal?.signing_pdf_url ||
      deal?.signed_pdf_url ||
      deal?.legal_agreement?.final_pdf_url ||
      deal?.legal_agreement?.signed_pdf_url ||
      room?.internal_agreement_document?.url;
    if (legacyUrl) {
      setInternalAgreementFile({
        url: legacyUrl,
        filename: deal?.agreement_filename || 'internal-agreement.pdf',
        uploaded_at: deal?.updated_date || new Date().toISOString()
      });
    }
  }, [
    internalAgreementFile,
    deal?.internal_agreement_signed_url,
    deal?.final_pdf_url,
    deal?.docusign_pdf_url,
    deal?.signing_pdf_url,
    deal?.signed_pdf_url,
    deal?.legal_agreement,
    room?.internal_agreement_document?.url
  ]);

  const handleUpload = async (docKey, e) => {
    const file = e.target.files[0];
    if (!file) return;

    const validation = validatePDF(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(docKey);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // PRODUCTION: Write ONLY to Deal.documents (canonical source)
      const updatedDocs = {
        ...documents,
        [docKey]: {
          file_url,
          filename: file.name,
          uploaded_at: new Date().toISOString(),
          uploaded_by: userRole
        }
      };

      // Single source of truth: Deal entity only
      await base44.entities.Deal.update(deal.id, { documents: updatedDocs });
      
      toast.success(`${file.name} uploaded successfully`);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("Upload failed:", error);
      toast.error("Failed to upload document");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-[#E3C567]" />
        Required Documents
      </h4>
      
      <div className="space-y-3">
        {REQUIRED_DOCUMENTS.map((doc) => {
          const uploaded = documents[doc.key];

          // Post-fully-signed: check resolved docs (fixed syntax)
          let resolvedFile = null;
          if (doc.key === 'purchase_contract' && (resolved.verifiedPurchaseContract?.url || resolved.sellerContract?.url)) {
            resolvedFile = resolved.verifiedPurchaseContract?.url ? resolved.verifiedPurchaseContract : resolved.sellerContract;
          } else if (doc.key === 'operating_agreement') {
            const iaFinal =
              documents.internal_agreement?.file_url ||
              documents.internal_agreement?.url;
            const iaDraft =
              documents.internal_agreement_draft?.file_url ||
              documents.internal_agreement_draft?.url ||
              room?.internal_agreement_document?.url;
            if (iaFinal) {
              resolvedFile = {
                url: iaFinal,
                filename: documents.internal_agreement?.filename,
                uploaded_at: documents.internal_agreement?.uploaded_at
              };
            } else if (iaDraft) {
              resolvedFile = {
                url: iaDraft,
                filename: documents.internal_agreement_draft?.filename || room?.internal_agreement_document?.name,
                uploaded_at: documents.internal_agreement_draft?.uploaded_at || room?.internal_agreement_document?.generated_at
              };
            } else if (internalAgreementFile?.url) {
              resolvedFile = internalAgreementFile;
            }
          } else if (doc.key === 'listing_agreement' && resolved.listingAgreement?.url) {
            resolvedFile = resolved.listingAgreement;
          }

          // Prefer object with a usable URL; robust fallback for Seller Contract
          const hasUrl = (obj) => !!(obj && (obj.url || obj.file_url || obj.urlSignedPdf));
          let fileToShow;
          if (doc.key === 'operating_agreement') {
            fileToShow = hasUrl(uploaded) ? uploaded : (resolvedFile || internalAgreementFile);
          } else if (doc.key === 'purchase_contract') {
            const hideSeller = userRole === 'agent' && !isWorkingTogether;
            const fallback = resolvedFile || { url: deal?.contract_document?.url || deal?.contract_url, filename: deal?.contract_document?.name };
            fileToShow = hideSeller ? null : (hasUrl(uploaded) ? uploaded : fallback);
          } else {
            fileToShow = hasUrl(uploaded) ? uploaded : (isWorkingTogether ? resolvedFile : null);
          }

          // Compute a robust URL for View/Download with deep fallbacks
          const hideSeller = userRole === 'agent' && !isWorkingTogether;
          const iaFinalUrl =
            documents.internal_agreement?.file_url ||
            documents.internal_agreement?.url;
          const iaDraftUrl =
            documents.internal_agreement_draft?.file_url ||
            documents.internal_agreement_draft?.url ||
            room?.internal_agreement_document?.url;

          const fileUrl = (doc.key === 'purchase_contract' && hideSeller)
            ? null
            : (
                doc.key === 'operating_agreement'
                  ? (
                      userRole === 'agent'
                        ? (isWorkingTogether ? (iaFinalUrl || null) : null)
                        : (iaFinalUrl || iaDraftUrl || resolved.internalAgreement?.urlSignedPdf || resolved.internalAgreement?.url || internalAgreementFile?.url || null)
                    )
                  : doc.key === 'listing_agreement'
                  ? resolved.listingAgreement?.url
                  : (
                      (fileToShow && (fileToShow.url || fileToShow.file_url || fileToShow.urlSignedPdf)) ||
                      (doc.key === 'purchase_contract'
                        ? (
                            resolved.verifiedPurchaseContract?.url ||
                            resolved.sellerContract?.url ||
                            deal?.documents?.purchase_contract?.file_url ||
                            deal?.documents?.purchase_contract?.url ||
                            deal?.contract_document?.url ||
                            deal?.contract_url ||
                            room?.contract_document?.file_url ||
                            room?.contract_document?.url
                          )
                        : null
                      )
                    )
              );
          const canUpload =
            doc.key !== 'operating_agreement' && (
              doc.uploadedBy === 'both' ||
              doc.uploadedBy === userRole ||
              (doc.key === 'purchase_contract' && userRole === 'investor')
            );

          return (
            <div 
              key={doc.key}
              className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  fileUrl ? 'bg-green-500/20' : 'bg-[#1F1F1F]'
                }`}>
                  {fileUrl ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#808080]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#FAFAFA]">{doc.label}</p>
                  <p className="text-xs text-[#808080]">{doc.description}</p>
                  {fileUrl && fileToShow && (
                     <div className="mt-1 flex items-center gap-2">
                       <p className="text-xs text-[#E3C567] truncate">{fileToShow.filename || fileToShow.name || 'Document'}</p>
                       <span className="text-xs text-[#666]">•</span>
                       <p className="text-xs text-[#666]">
                         {new Date(fileToShow.uploaded_at || fileToShow.createdAt || deal?.updated_date || Date.now()).toLocaleDateString()}
                       </p>
                     </div>
                   )}
                </div>
              </div>

              <div className="flex-shrink-0 ml-4 flex items-center gap-2">
                {fileUrl ? (
                  <>
                    <a
                      href={fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] px-3 py-1.5 rounded-full transition-colors"
                      onClick={(e) => { e.preventDefault(); if (fileUrl) window.open(fileUrl, '_blank', 'noopener'); }}
                    >
                      View
                    </a>
                    <a
                      href={fileUrl}
                      download={fileToShow?.filename || fileToShow?.name || `${doc.key}.pdf`}
                      className="text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
                      onClick={(e) => {
                        e.preventDefault();
                        if (!fileUrl) return;
                        const link = document.createElement('a');
                        link.href = fileUrl;
                        link.download = fileToShow?.filename || fileToShow?.name || `${doc.key}.pdf`;
                        document.body.appendChild(link);
                        link.click();
                        link.remove();
                      }}
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </a>
                  </>
                ) : canUpload ? (
                  <label className="cursor-pointer text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1">
                    {uploading === doc.key ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Upload className="w-3 h-3" />
                        Upload
                      </>
                    )}
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={(e) => handleUpload(doc.key, e)}
                      disabled={uploading === doc.key}
                    />
                  </label>
                ) : (
                  <span className="text-xs text-[#666] px-3 py-1.5">—</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}