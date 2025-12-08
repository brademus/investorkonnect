
/**
 * DEMO MODE CONFIGURATION
 * 
 * Set DEMO_MODE = true for demo/prototype presentations
 * Set DEMO_MODE = false for production with real backend services
 */

export const DEMO_MODE = false; // Set to true for demo, false for production

export const DEMO_CONFIG = {
  skipPersonaKYC: false,       // Bypass Persona verification
  skipStripePayments: false,   // Bypass Stripe checkout
  skipAIContracts: false,      // Use static contract templates
  useStaticData: false,        // Use demo fixtures for directories/rooms
  autoApproveKYC: false,       // Instantly "approve" KYC in demo
  autoAcceptNDA: false,       // Still require NDA click-through
};

export default {
  DEMO_MODE,
  DEMO_CONFIG
};
