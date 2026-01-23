
import { base44 } from '@/api/base44Client';

// Typed wrappers for Base44 functions actively used by frontend
// Stripe Payment Functions
export const createCheckoutSession = base44.functions.createCheckoutSession;
export const syncSubscription = base44.functions.syncSubscription;

// Core Functions
export const createDealRoom = base44.functions.createDealRoom;
export const findBestAgents = base44.functions.findBestAgents;
export const matchAgentsForInvestor = base44.functions.matchAgentsForInvestor;

// Admin Functions
export const adminNdaSet = base44.functions.adminNdaSet;
export const adminSetup = base44.functions.adminSetup;
export const grantAdmin = base44.functions.grantAdmin;

// Persona KYC Functions
export const personaConfig = base44.functions.personaConfig;

// Escrow.com Integration Functions
export const initiateEscrowTransaction = base44.functions.initiateEscrowTransaction;
export const getEscrowStatus = base44.functions.getEscrowStatus;
export const fundEscrow = base44.functions.fundEscrow;
export const releaseEscrow = base44.functions.releaseEscrow;
