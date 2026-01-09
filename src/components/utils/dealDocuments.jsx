/**
 * Document resolver utility for normalizing deal document access.
 * Reads from multiple possible locations and provides a single source of truth.
 * UI-only: does not modify DB or call new APIs.
 */

export function resolveDealDocuments({ deal = {}, room = {} }) {
  const docs = deal?.documents || {};
  
  // Helper to check if URL exists and is valid
  const hasUrl = (url) => typeof url === 'string' && url.length > 0;
  
  return {
    // Seller Contract - from Deal.documents or deal fields
    sellerContract: {
      label: 'Seller Contract',
      url: docs.purchase_contract?.file_url || docs.purchase_contract?.url || docs.seller_contract?.file_url || docs.seller_contract?.url || deal?.contract_document?.url || deal?.contract_url || deal?.documents?.purchase_contract?.file_url || deal?.documents?.purchase_contract?.url ,
      verified: docs.purchase_contract?.verified || docs.seller_contract?.verified,
      filename: docs.purchase_contract?.filename || docs.seller_contract?.filename || deal?.contract_document?.name || room?.contract_document?.name,
      createdAt: docs.purchase_contract?.uploaded_at || docs.seller_contract?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Verified Purchase Contract - robust
    verifiedPurchaseContract: {
      label: 'Verified Purchase Contract',
      url: docs.verified_purchase_contract?.file_url || docs.verified_purchase_contract?.url || docs.purchase_contract?.file_url || docs.purchase_contract?.url || deal?.documents?.verified_purchase_contract?.file_url || deal?.documents?.verified_purchase_contract?.url,
      verified: docs.verified_purchase_contract?.verified || docs.purchase_contract?.verified,
      filename: docs.verified_purchase_contract?.filename || docs.purchase_contract?.filename,
      createdAt: docs.verified_purchase_contract?.uploaded_at || docs.purchase_contract?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Internal Agreement - robust fallbacks
    internalAgreement: {
      label: 'Internal Agreement',
      urlSignedPdf:
        docs.internal_agreement?.file_url ||
        docs.internal_agreement?.url ||
        docs.internal_agreement?.signed_pdf_url ||
        deal?.internal_agreement_signed_url ||
        deal?.signed_pdf_url ||
        deal?.final_pdf_url ||
        deal?.docusign_pdf_url ,
      urlDraft: docs.internal_agreement_draft?.file_url || docs.internal_agreement_draft?.url,
      filename: docs.internal_agreement?.filename,
      createdAt: docs.internal_agreement?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Listing Agreement - from Deal.documents.listing_agreement
    listingAgreement: {
      label: 'Listing Agreement',
      url: docs.listing_agreement?.file_url || docs.listing_agreement?.url,
      verified: docs.listing_agreement?.verified,
      filename: docs.listing_agreement?.filename,
      createdAt: docs.listing_agreement?.uploaded_at,
      source: 'deal.documents'
    },
    
    // All other uploaded files from Room
    sharedUploads: (room?.files || []).map(f => ({
      label: f.name,
      url: f.url,
      filename: f.name,
      uploadedBy: f.uploaded_by_name,
      createdAt: f.uploaded_at,
      size: f.size,
      type: f.type,
      source: 'room.files'
    }))
  };
}

/**
 * Build unified document list for Shared Files tab (post-fully-signed only)
 * Merges system documents with user uploads, deduped and sorted.
 */
export function buildUnifiedFilesList({ deal = {}, room = {} }) {
  const resolved = resolveDealDocuments({ deal, room });
  const allFiles = [];
  const urlsSeen = new Set();
  
  // Helper to add file if URL exists and not already added
  const addIfNew = (item) => {
    const url = item?.url || item?.urlSignedPdf || item?.urlDraft || item?.file_url;
    if (url && !urlsSeen.has(url)) {
      urlsSeen.add(url);
      allFiles.push({
        ...item,
        url: url, // Ensure url is set
        type: item.type || 'application/pdf'
      });
    }
  };
  
  // System documents first (prefer verified seller contract)
  const sellerPreferred = resolved.verifiedPurchaseContract?.url
    ? { ...resolved.verifiedPurchaseContract, label: 'Seller Contract' }
    : (resolved.sellerContract?.url ? { ...resolved.sellerContract, label: 'Seller Contract' } : null);
  if (sellerPreferred) addIfNew(sellerPreferred);
  addIfNew(resolved.internalAgreement);
  addIfNew(resolved.listingAgreement);
  
  // User-uploaded files
  resolved.sharedUploads.forEach(addIfNew);
  
  // Sort: system docs first by natural order, then user uploads by createdAt
  const systemCount = 4;
  const systemDocs = allFiles.slice(0, Math.min(systemCount, allFiles.length));
  const userDocs = allFiles.slice(systemDocs.length).sort((a, b) => {
    const aDate = new Date(a.createdAt || 0);
    const bDate = new Date(b.createdAt || 0);
    return bDate - aDate; // Newest first
  });
  
  return [...systemDocs, ...userDocs];
}