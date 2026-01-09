import React, { useState } from "react";
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
    key: 'listing_agreement', 
    label: 'Listing Agreement',
    description: "Agent's listing agreement from brokerage",
    uploadedBy: 'agent'
  },
  { 
    key: 'operating_agreement', 
    label: 'Internal Agreement',
    description: 'Internal investor-agent operating agreement',
    uploadedBy: 'both'
  },
  { 
    key: 'buyer_contract', 
    label: 'Buyer Contract',
    description: 'Final buyer representation agreement',
    uploadedBy: 'both'
  }
];

export default function DocumentChecklist({ deal, userRole, onUpdate }) {
  const [uploading, setUploading] = useState(null);

  const documents = deal?.documents || {};
  const resolved = resolveDealDocuments({ deal });
  const isWorkingTogether = (
    deal?.agreement_status === 'fully_signed' ||
    deal?.is_fully_signed === true
  );

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
          
          // Post-fully-signed: check resolved docs
          let resolvedFile = null;
          if (doc.key === 'purchase_contract' && (resolved.sellerContract?.url || resolved.verifiedPurchaseContract?.url)) {
            resolvedFile = resolved.sellerContract?.url ? resolved.sellerContract : resolved.verifiedPurchaseContract;
          } else if (doc.key === 'operating_agreement' && resolved.internalAgreement?.urlSignedPdf) {
            resolvedFile = resolved.internalAgreement;
          } else if (doc.key === 'listing_agreement' && resolved.listingAgreement?.url) {
            resolvedFile = resolved.listingAgreement;
          }
          
          const fileToShow = uploaded || (isWorkingTogether ? resolvedFile : null);
          const canUpload = 
            doc.uploadedBy === 'both' || 
            doc.uploadedBy === userRole ||
            (doc.key === 'purchase_contract' && userRole === 'investor');

          return (
            <div 
              key={doc.key}
              className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  fileToShow ? 'bg-green-500/20' : 'bg-[#1F1F1F]'
                }`}>
                  {fileToShow ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-[#808080]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#FAFAFA]">{doc.label}</p>
                  <p className="text-xs text-[#808080]">{doc.description}</p>
                  {fileToShow && (
                    <div className="mt-1 flex items-center gap-2">
                      <p className="text-xs text-[#E3C567] truncate">{fileToShow.filename || 'Document'}</p>
                      <span className="text-xs text-[#666]">•</span>
                      <p className="text-xs text-[#666]">
                        {new Date(fileToShow.uploaded_at || fileToShow.createdAt || Date.now()).toLocaleDateString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-shrink-0 ml-4 flex items-center gap-2">
                {fileToShow ? (
                  <>
                    <a
                      href={fileToShow.file_url || fileToShow.url || fileToShow.urlSignedPdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] px-3 py-1.5 rounded-full transition-colors"
                    >
                      View
                    </a>
                    <a
                      href={fileToShow.file_url || fileToShow.url || fileToShow.urlSignedPdf}
                      download={fileToShow.filename || fileToShow.name || `${doc.key}.pdf`}
                      className="text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-3 py-1.5 rounded-full transition-colors flex items-center gap-1"
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