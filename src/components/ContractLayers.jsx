import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { FileText, Upload, CheckCircle, Clock, AlertCircle, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export default function ContractLayers({ room, deal, onUpdate, userRole }) {
  const [uploading, setUploading] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const handleListingAgreementUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const { validatePDF } = await import('@/components/utils/fileValidation');
    const validation = validatePDF(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setUploading(true);
    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Verify against seller contract and internal agreement
      setVerifying(true);
      const verificationPrompt = `
You are verifying an agent's listing agreement against existing contract documents.

SELLER CONTRACT DETAILS:
- Property: ${deal?.property_address || 'N/A'}
- City: ${deal?.city || 'N/A'}, State: ${deal?.state || 'N/A'}
- Purchase Price: $${(deal?.purchase_price || 0).toLocaleString()}
- Closing Date: ${deal?.key_dates?.closing_date || 'N/A'}

INTERNAL AGREEMENT TERMS:
- Seller Agent Commission: ${room?.proposed_terms?.seller_commission_type === 'percentage' ? `${room.proposed_terms.seller_commission_percentage}%` : room?.proposed_terms?.seller_flat_fee ? `$${room.proposed_terms.seller_flat_fee.toLocaleString()}` : 'N/A'}
- Buyer Agent Commission: ${room?.proposed_terms?.buyer_commission_type === 'percentage' ? `${room.proposed_terms.buyer_commission_percentage}%` : room?.proposed_terms?.buyer_flat_fee ? `$${room.proposed_terms.buyer_flat_fee.toLocaleString()}` : 'N/A'}
- Agreement Length: ${room?.proposed_terms?.agreement_length ? `${room.proposed_terms.agreement_length} days` : 'N/A'}

Analyze the uploaded listing agreement and check if:
1. Property address matches
2. Price/commission structure is consistent
3. Key terms align with the internal agreement

Return a verification result with any discrepancies found.
`;

      const verification = await base44.integrations.Core.InvokeLLM({
        prompt: verificationPrompt,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            verified: { type: "boolean" },
            notes: { type: "string" },
            discrepancies: { 
              type: "array", 
              items: { type: "string" } 
            }
          }
        }
      });

      // Update Deal.documents with listing agreement (canonical source)
      const updatedDocs = {
        ...(deal?.documents || {}),
        listing_agreement: {
          file_url,
          filename: file.name,
          uploaded_at: new Date().toISOString(),
          verified: verification.verified,
          verification_notes: verification.notes
        }
      };
      
      await base44.entities.Deal.update(deal.id, {
        documents: updatedDocs
      });

      if (verification.verified) {
        toast.success("Listing agreement uploaded and verified!");
      } else {
        toast.warning("Listing agreement uploaded but verification found discrepancies. Review notes.");
      }

      onUpdate();
    } catch (error) {
      console.error("Failed to upload listing agreement:", error);
      toast.error("Failed to upload listing agreement");
    } finally {
      setUploading(false);
      setVerifying(false);
    }
  };

  const getContractStatus = (type) => {
    switch (type) {
      case 'seller':
        // Read from Deal.documents only (canonical source)
        return deal?.documents?.purchase_contract?.file_url ? 
          (deal?.documents?.purchase_contract?.verified ? 'verified' : 'uploaded') : 'pending';
      case 'internal':
        return room?.agreement_status === 'fully_signed' ? 'signed' : 
               room?.agreement_status === 'investor_signed' ? 'pending_agent' :
               room?.agreement_status === 'agent_signed' ? 'pending_investor' :
               room?.agreement_status === 'sent' ? 'sent' :
               room?.proposed_terms ? 'draft' : 'pending';
      case 'listing':
        // Read from Deal.documents only (canonical source)
        return deal?.documents?.listing_agreement?.file_url ? 
          (deal?.documents?.listing_agreement?.verified ? 'verified' : 'uploaded') : 
          'pending_upload';
      default:
        return 'pending';
    }
  };

  const StatusBadge = ({ status }) => {
    const config = {
      uploaded: { label: 'Uploaded', icon: CheckCircle, className: 'bg-[#34D399]/20 text-[#34D399] border-[#34D399]/30' },
      signed: { label: 'Fully Signed', icon: CheckCircle, className: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30' },
      verified: { label: 'Verified', icon: CheckCircle, className: 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/30' },
      draft: { label: 'Draft', icon: Clock, className: 'bg-[#808080]/20 text-[#808080] border-[#808080]/30' },
      sent: { label: 'Sent for Signature', icon: Clock, className: 'bg-[#60A5FA]/20 text-[#60A5FA] border-[#60A5FA]/30' },
      pending_agent: { label: 'Awaiting Agent', icon: Clock, className: 'bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30' },
      pending_investor: { label: 'Awaiting Investor', icon: Clock, className: 'bg-[#E3C567]/20 text-[#E3C567] border-[#E3C567]/30' },
      pending_upload: { label: 'Pending Upload', icon: AlertCircle, className: 'bg-[#808080]/20 text-[#808080] border-[#808080]/30' },
      pending: { label: 'Pending', icon: Clock, className: 'bg-[#808080]/20 text-[#808080] border-[#808080]/30' }
    }[status] || { label: 'Unknown', icon: AlertCircle, className: 'bg-[#808080]/20 text-[#808080] border-[#808080]/30' };

    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.className}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const sellerStatus = getContractStatus('seller');
  const internalStatus = getContractStatus('internal');
  const listingStatus = getContractStatus('listing');

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h4 className="text-lg font-semibold text-[#FAFAFA] flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#E3C567]" />
          Contract Layers
        </h4>
      </div>

      <div className="space-y-4">
        {/* 1. Seller Contract - Privacy Protected */}
        <div className="p-4 bg-[#141414] border border-[#1F1F1F] rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#FAFAFA]">1. Seller Contract</span>
                <StatusBadge status={sellerStatus} />
              </div>
              <p className="text-xs text-[#808080]">Purchase agreement uploaded by investor</p>
            </div>
          </div>
          {userRole === 'agent' && !room?.is_fully_signed ? (
            <div className="text-xs text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded p-2 flex items-center gap-2">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>Hidden until agreement is fully signed</span>
            </div>
          ) : deal?.documents?.purchase_contract?.file_url ? (
            <div className="flex items-center gap-2">
              <a
                href={deal.documents.purchase_contract.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#E3C567] hover:underline flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                {deal.documents.purchase_contract.filename || 'View Contract'}
              </a>
              <a
                href={deal.documents.purchase_contract.file_url}
                download={deal.documents.purchase_contract.filename || 'seller-contract.pdf'}
                className="text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-2 py-1 rounded font-medium flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
          ) : null}
        </div>

        {/* 2. Internal Investor-Agent Agreement */}
        <div className="p-4 bg-[#141414] border border-[#1F1F1F] rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#FAFAFA]">2. Internal Agreement</span>
                <StatusBadge status={internalStatus} />
              </div>
              <p className="text-xs text-[#808080]">Investor-Agent agreement based on proposed terms</p>
            </div>
          </div>
          {room?.proposed_terms && (
            <div className="text-xs text-[#FAFAFA] space-y-1 mt-2">
              {room.proposed_terms.seller_commission_type && (
                <p>Seller Agent: {room.proposed_terms.seller_commission_type === 'percentage' 
                  ? `${room.proposed_terms.seller_commission_percentage}%` 
                  : `$${room.proposed_terms.seller_flat_fee?.toLocaleString()}`}
                </p>
              )}
              {room.proposed_terms.buyer_commission_type && (
                <p>Buyer Agent: {room.proposed_terms.buyer_commission_type === 'percentage' 
                  ? `${room.proposed_terms.buyer_commission_percentage}%` 
                  : `$${room.proposed_terms.buyer_flat_fee?.toLocaleString()}`}
                </p>
              )}
              {room.proposed_terms.agreement_length && (
                <p>Term: {room.proposed_terms.agreement_length} days</p>
              )}
            </div>
          )}
          {deal?.documents?.internal_agreement?.file_url && (
            <div className="flex items-center gap-2 mt-3">
              <a
                href={deal.documents.internal_agreement.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#E3C567] hover:underline flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                View Agreement
              </a>
              <a
                href={deal.documents.internal_agreement.file_url}
                download={deal.documents.internal_agreement.filename || 'internal-agreement.pdf'}
                className="text-xs bg-[#E3C567] hover:bg-[#EDD89F] text-black px-2 py-1 rounded font-medium flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download
              </a>
            </div>
          )}
        </div>

        {/* 3. Agent's Listing Agreement */}
        <div className="p-4 bg-[#141414] border border-[#1F1F1F] rounded-xl">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-semibold text-[#FAFAFA]">3. Listing Agreement</span>
                <StatusBadge status={listingStatus} />
              </div>
              <p className="text-xs text-[#808080]">Agent's brokerage listing agreement</p>
            </div>
          </div>

          {deal?.documents?.listing_agreement?.file_url ? (
            <div className="space-y-2">
              <a
                href={deal.documents.listing_agreement.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#E3C567] hover:underline flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                {deal.documents.listing_agreement.filename || 'View Listing Agreement'}
              </a>
              {deal.documents.listing_agreement.verification_notes && (
                <div className={`text-xs p-2 rounded border ${
                  deal.documents.listing_agreement.verified 
                    ? 'bg-[#10B981]/10 text-[#10B981] border-[#10B981]/30' 
                    : 'bg-[#F59E0B]/10 text-[#F59E0B] border-[#F59E0B]/30'
                }`}>
                  {deal.documents.listing_agreement.verification_notes}
                </div>
              )}
            </div>
          ) : userRole === 'agent' ? (
            <div className="mt-2">
              <input
                type="file"
                accept="application/pdf"
                onChange={handleListingAgreementUpload}
                className="hidden"
                id="listing-agreement-upload"
                disabled={uploading || verifying}
              />
              <label htmlFor="listing-agreement-upload">
                <Button
                  type="button"
                  size="sm"
                  disabled={uploading || verifying}
                  className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full cursor-pointer"
                  onClick={() => document.getElementById('listing-agreement-upload')?.click()}
                >
                  {uploading || verifying ? (
                    <>
                      <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                      {verifying ? 'Verifying...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <Upload className="w-3 h-3 mr-1" />
                      Upload Listing Agreement
                    </>
                  )}
                </Button>
              </label>
            </div>
          ) : (
            <p className="text-xs text-[#808080] mt-2">Waiting for agent to upload</p>
          )}
        </div>
      </div>
    </div>
  );
}