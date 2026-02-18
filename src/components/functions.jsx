
import { base44 } from '@/api/base44Client';

// Admin functions
export const adminNdaSet = base44.functions.adminNdaSet;
export const adminSetup = base44.functions.adminSetup;
export const grantAdmin = base44.functions.grantAdmin;

// Billing & Subscription
export const billingPortal = base44.functions.billingPortal;
export const checkoutLite = base44.functions.checkoutLite;
export const checkoutSession = base44.functions.checkoutSession;
export const createCheckoutSession = base44.functions.createCheckoutSession;
export const stripeValidate = base44.functions.stripeValidate;
export const stripeWebhook = base44.functions.stripeWebhook;
export const subscribe = base44.functions.subscribe;
export const syncSubscription = base44.functions.syncSubscription;

// Profile & Auth
export const ensureProfile = base44.functions.ensureProfile;
export const me = base44.functions.me;
export const profileDedup = base44.functions.profileDedup;
export const profileGet = base44.functions.profileGet;
export const profileHealthCheck = base44.functions.profileHealthCheck;
export const profileUpsert = base44.functions.profileUpsert;
export const resetProfiles = base44.functions.resetProfiles;
export const whoami = base44.functions.whoami;
export const session = base44.functions.session;

// Onboarding
export const onboardingComplete = base44.functions.onboardingComplete;
export const upsertAgentOnboarding = base44.functions.upsertAgentOnboarding;
export const upsertBuyBox = base44.functions.upsertBuyBox;
export const upsertInvestorOnboarding = base44.functions.upsertInvestorOnboarding;

// NDA & Verification
export const ndaAccept = base44.functions.ndaAccept;
export const ndaStatus = base44.functions.ndaStatus;
export const personaFinalize = base44.functions.personaFinalize;
export const personaPoll = base44.functions.personaPoll;
export const personaStart = base44.functions.personaStart;
export const personaWebhook = base44.functions.personaWebhook;
export const personaConfig = base44.functions.personaConfig; // Moved from 'Persona KYC functions'

// Deals & Rooms
export const createDealRoom = base44.functions.createDealRoom;
export const demoSeed = base44.functions.demoSeed;
export const health = base44.functions.health;
export const inboxList = base44.functions.inboxList;
export const introCreate = base44.functions.introCreate;
export const introRespond = base44.functions.introRespond;
export const listMyRooms = base44.functions.listMyRooms;
export const messagePost = base44.functions.messagePost;
export const roomGet = base44.functions.roomGet;
export const roomUpdate = base44.functions.roomUpdate;
export const sendMessage = base44.functions.sendMessage;

// Matching & Embeddings
export const matchInvestor = base44.functions.matchInvestor;
export const matchList = base44.functions.matchList;
export const matchMake = base44.functions.matchMake;
export const matchingEngine = base44.functions.matchingEngine;
export const refreshAllEmbeddings = base44.functions.refreshAllEmbeddings;
export const updateAgentEmbedding = base44.functions.updateAgentEmbedding;
export const updateInvestorEmbedding = base44.functions.updateInvestorEmbedding;

// Agent Metrics
export const getAgentPerformanceMetrics = base44.functions.getAgentPerformanceMetrics;

// Other Functions (retained from original file for compatibility)
export const contractGenerateDraft = base44.functions.contractGenerateDraft;
export const createMilestonePaymentIntent = base44.functions.createMilestonePaymentIntent;
export const embedProfile = base44.functions.embedProfile;
export const getContract = base44.functions.getContract;
export const getInvestorMatches = base44.functions.getInvestorMatches;
export const getScheduleForDeal = base44.functions.getScheduleForDeal;
export const listContracts = base44.functions.listContracts;
export const listMessages = base44.functions.listMessages;
export const matchAgentsForInvestor = base44.functions.matchAgentsForInvestor;
export const matchInvestorsForAgent = base44.functions.matchInvestorsForAgent;
export const searchCounterparties = base44.functions.searchCounterparties;

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
export const getInvestorPortfolioData = base44.functions.getInvestorPortfolioData;
export const generateDueDiligenceChecklist = base44.functions.generateDueDiligenceChecklist;

// Escrow.com Integration Functions
export const initiateEscrowTransaction = base44.functions.initiateEscrowTransaction;
export const getEscrowStatus = base44.functions.getEscrowStatus;
export const fundEscrow = base44.functions.fundEscrow;
export const releaseEscrow = base44.functions.releaseEscrow;
export const findBestAgents = base44.functions.findBestAgents;
