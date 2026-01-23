
import { base44 } from '@/api/base44Client';

// Typed wrappers for Base44 functions actively used by frontend
export const adminNdaSet = base44.functions.adminNdaSet;
export const adminSetup = base44.functions.adminSetup;
export const checkoutLite = base44.functions.checkoutLite;
export const createDealRoom = base44.functions.createDealRoom;
export const demoSeed = base44.functions.demoSeed;
export const inboxList = base44.functions.inboxList;
export const matchAgentsForInvestor = base44.functions.matchAgentsForInvestor;
export const profileDedup = base44.functions.profileDedup;
export const profileHealthCheck = base44.functions.profileHealthCheck;
export const refreshAllEmbeddings = base44.functions.refreshAllEmbeddings;
export const roomUpdate = base44.functions.roomUpdate;
export const syncSubscription = base44.functions.syncSubscription;

// Library helpers (exposed under JS-safe names)
export const libOpenaiClient = base44.functions["lib/openaiClient"];
export const libText = base44.functions["lib/text"];
export const libCosine = base44.functions["lib/cosine"];
export const libHash = base44.functions["lib/hash"];
export const libOpenaiContractsClient = base44.functions["lib/openaiContractsClient"];

// 10x Enhancement Functions
export const predictiveMatchScore = base44.functions.predictiveMatchScore;
export const suggestBuyBoxRefinement = base44.functions.suggestBuyBoxRefinement;
export const generatePitchAdjustment = base44.functions.generatePitchAdjustment;
export const getPersonalizedMarketIntel = base44.functions.getPersonalizedMarketIntel;
export const getAgentPerformanceMetrics = base44.functions.getAgentPerformanceMetrics;
export const getInvestorPortfolioData = base44.functions.getInvestorPortfolioData;
export const generateDueDiligenceChecklist = base44.functions.generateDueDiligenceChecklist;

// Escrow.com Integration Functions
export const initiateEscrowTransaction = base44.functions.initiateEscrowTransaction;
export const getEscrowStatus = base44.functions.getEscrowStatus;
export const fundEscrow = base44.functions.fundEscrow;
export const releaseEscrow = base44.functions.releaseEscrow;
export const findBestAgents = base44.functions.findBestAgents;
export const grantAdmin = base44.functions.grantAdmin;

// Persona KYC functions
export const personaConfig = base44.functions.personaConfig;
