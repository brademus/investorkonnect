/**
 * DEMO MODE CONFIGURATION
 * 
 * Set DEMO_MODE = true for demo/prototype presentations
 * Set DEMO_MODE = false for production with real backend services
 */

export const DEMO_MODE = true; // Set to true for demo, false for production

export const DEMO_CONFIG = {
  skipPersonaKYC: true,       // Bypass Persona verification
  skipStripePayments: true,   // Bypass Stripe checkout
  skipAIContracts: true,      // Use static contract templates
  useStaticData: true,        // Use demo fixtures for directories/rooms
  autoApproveKYC: true,       // Instantly "approve" KYC in demo
  autoAcceptNDA: false,       // Still require NDA click-through
};

export default {
  DEMO_MODE,
  DEMO_CONFIG
};