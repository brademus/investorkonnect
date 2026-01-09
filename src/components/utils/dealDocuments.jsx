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
    // Seller Contract - from Deal.documents.purchase_contract or deal.documents.seller_contract
    sellerContract: {
      label: 'Seller Contract',
      url: docs.purchase_contract?.file_url || docs.seller_contract?.file_url,
      verified: docs.purchase_contract?.verified || docs.seller_contract?.verified,
      filename: docs.purchase_contract?.filename || docs.seller_contract?.filename,
      createdAt: docs.purchase_contract?.uploaded_at || docs.seller_contract?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Verified Purchase Contract - typically same as seller contract in this system
    verifiedPurchaseContract: {
      label: 'Verified Purchase Contract',
      url: docs.verified_purchase_contract?.file_url || docs.purchase_contract?.file_url,
      verified: docs.verified_purchase_contract?.verified || docs.purchase_contract?.verified,
      filename: docs.verified_purchase_contract?.filename || docs.purchase_contract?.filename,
      createdAt: docs.verified_purchase_contract?.uploaded_at || docs.purchase_contract?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Internal Agreement - from Deal.documents.internal_agreement
    internalAgreement: {
      label: 'Internal Agreement',
      urlSignedPdf: docs.internal_agreement?.file_url || deal.internal_agreement_signed_url,
      urlDraft: docs.internal_agreement_draft?.file_url,
      filename: docs.internal_agreement?.filename,
      createdAt: docs.internal_agreement?.uploaded_at,
      source: 'deal.documents'
    },
    
    // Listing Agreement - from Deal.documents.listing_agreement
    listingAgreement: {
      label: 'Listing Agreement',
      url: docs.listing_agreement?.file_url,
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
    if (item?.url && !urlsSeen.has(item.url)) {
      urlsSeen.add(item.url);
      allFiles.push({
        ...item,
        type: item.type || 'application/pdf'
      });
    }
  };
  
  // System documents first (in order)
  addIfNew(resolved.sellerContract);
  addIfNew(resolved.verifiedPurchaseContract);
  addIfNew(resolved.internalAgreement);
  addIfNew(resolved.listingAgreement);
  
  // User-uploaded files
  resolved.sharedUploads.forEach(addIfNew);
  
  // Sort: system docs first by natural order, then user uploads by createdAt
  const systemCount = 4;
  const systemDocs = allFiles.slice(0, systemCount);
  const userDocs = allFiles.slice(systemCount).sort((a, b) => {
    const aDate = new Date(a.createdAt || 0);
    const bDate = new Date(b.createdAt || 0);
    return bDate - aDate; // Newest first
  });
  
  return [...systemDocs, ...userDocs];
}