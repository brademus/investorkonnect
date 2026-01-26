/**
 * Canonical Pipeline Stage Definitions
 * Single source of truth for all stage IDs, labels, and ordering
 */

export const PIPELINE_STAGES = [
  { id: 'new_deals', label: 'New Deals (Pending Agent)', order: 1 },
  { id: 'connected_deals', label: 'Connected Deals', order: 2 },
  { id: 'active_listings', label: 'Active Listings', order: 3 },
  { id: 'in_closing', label: 'In Closing', order: 4 },
  { id: 'completed', label: 'Completed', order: 5 },
  { id: 'canceled', label: 'Canceled', order: 6 }
];

/**
 * Legacy stage ID mappings for backward compatibility
 * Maps old stage IDs to new canonical IDs
 */
export const LEGACY_STAGE_MAP = {
  // Old names map to new canonical names
  'new_listings': 'new_deals',
  'new_deal_under_contract': 'new_deals',
  'active_listings': 'active_listings',
  'walkthrough_scheduled': 'active_listings',
  'evaluate_deal': 'active_listings',
  'active_marketing': 'active_listings',
  'ready_to_close': 'in_closing',
  'in_closing': 'in_closing',
  'closed': 'completed',
  'clear_to_close_closed': 'completed',
  'cancelling_deal': 'canceled',
  'canceled': 'canceled',
  'cancelled': 'canceled',
  
  // Additional legacy variants
  'new_deal': 'new_deals',
  'pending': 'new_deals',
  'active': 'active_listings',
  'closing': 'in_closing'
};

/**
 * Normalizes a stage ID to the canonical format
 * @param {string} stageId - The stage ID to normalize
 * @returns {string} - The canonical stage ID
 */
export function normalizeStage(stageId) {
  if (!stageId) return 'new_deals'; // Default
  
  // Already canonical
  if (PIPELINE_STAGES.some(s => s.id === stageId)) {
    return stageId;
  }
  
  // Map legacy to canonical
  return LEGACY_STAGE_MAP[stageId] || 'new_deals';
}

/**
 * Gets the display label for a stage
 * @param {string} stageId - The stage ID
 * @returns {string} - The display label
 */
export function getStageLabel(stageId) {
  const normalized = normalizeStage(stageId);
  const stage = PIPELINE_STAGES.find(s => s.id === normalized);
  return stage ? stage.label : 'New Deals (Pending Agent)';
}

/**
 * Gets the numeric order of a stage for sorting/comparison
 * @param {string} stageId - The stage ID
 * @returns {number} - The order number (1-based)
 */
export function stageOrder(stageId) {
  const normalized = normalizeStage(stageId);
  const stage = PIPELINE_STAGES.find(s => s.id === normalized);
  return stage ? stage.order : 1;
}

/**
 * Gets all stage objects in order
 * @returns {Array} - Array of stage objects
 */
export function getAllStages() {
  return [...PIPELINE_STAGES];
}