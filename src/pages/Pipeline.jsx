import React, { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import { AuthGuard } from "@/components/AuthGuard";
import { Header } from "@/components/Header";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import LegalFooterLinks from "@/components/LegalFooterLinks";
import { 
  FileText, Calendar, TrendingUp, Megaphone, CheckCircle,
  ArrowLeft, Plus, Home, Bath, Maximize2, DollarSign,
  Clock, CheckSquare, XCircle, MessageSquare, Circle, Loader2,
  AlertCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCachedDeal } from "@/components/utils/dealCache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getOrCreateDealRoom } from "@/components/dealRooms";
import { requireInvestorSetup } from "@/components/requireInvestorSetup";
import { getRoomsFromListMyRoomsResponse } from "@/components/utils/getRoomsFromListMyRooms";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import SetupChecklist from "@/components/SetupChecklist";
import HelpPanel from "@/components/HelpPanel";
import { PIPELINE_STAGES, normalizeStage, getStageLabel, stageOrder } from "@/components/pipelineStages";
import { getAgreementStatusLabel } from "@/components/utils/agreementStatus";
import { getPriceAndComp } from "@/components/utils/dealCompDisplay";

function PipelineContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { profile, loading, refresh, onboarded } = useCurrentProfile();
  const triedEnsureProfileRef = useRef(false);
  const dedupRef = useRef(false);
  const [deduplicating, setDeduplicating] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [identity, setIdentity] = useState(null);
  const [identityLoaded, setIdentityLoaded] = useState(false);
  const [allowExtras, setAllowExtras] = useState(false);
  useEffect(() => { const t = setTimeout(() => setAllowExtras(true), 250); return () => clearTimeout(t); }, []);

  // CRITICAL: Redirect to onboarding if not complete
  useEffect(() => {
    if (loading) return;
    
    // Prevent redirect loop: don't redirect if we just came from PostAuth
    const fromPostAuth = sessionStorage.getItem('from_postauth') === 'true';
    if (!profile && !fromPostAuth) {
      sessionStorage.setItem('from_postauth', 'true');
      navigate(createPageUrl("PostAuth"), { replace: true });
      return;
    }
    
    // Clear flag on successful load
    if (profile) {
      sessionStorage.removeItem('from_postauth');
    }
    
    if (!profile) return; // CRITICAL: Guard against null profile
    
    if (!onboarded) {
      const role = profile.user_role;
      if (role === 'investor') {
        navigate(createPageUrl("InvestorOnboarding"), { replace: true });
      } else if (role === 'agent') {
        navigate(createPageUrl("AgentOnboarding"), { replace: true });
      }
      return;
    }

    // Strict gating for Pipeline access
    const role = profile.user_role;

    // 1. Subscription (Investors)
    const isPaidSubscriber = profile?.role === 'admin' || profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing';
    if (role === 'investor' && !isPaidSubscriber) {
      navigate(createPageUrl("Pricing"), { replace: true });
      return;
    }

    // 2. KYC (Agents + Investors sometimes)
    const kycStatus = profile?.role === 'admin' ? 'approved' : (profile?.kyc_status || profile?.identity_status || 'unverified');
    const isKycVerified = profile?.role === 'admin' || kycStatus === 'approved' || kycStatus === 'verified' || !!profile?.identity_verified || !!profile?.identity_verified_at;

    // 2. KYC (Everyone)
    if (!isKycVerified) {
       navigate(createPageUrl("IdentityVerification"), { replace: true });
       return;
    }

    // 3. NDA (Everyone)
    const hasNDA = profile?.role === 'admin' || !!profile?.nda_accepted;
    if (!hasNDA) {
      navigate(createPageUrl("NDA"), { replace: true });
      return;
    }
  }, [loading, profile, onboarded, navigate]);

  // Scope caches per logged-in profile to prevent cross-account flicker
  const dealsCacheKey = profile?.id ? `pipelineDealsCache_${profile.id}` : null;
  const roomsCacheKey = profile?.id ? `roomsCache_${profile.id}` : null;

  // Clean up any legacy/global caches when user switches
  useEffect(() => {
    try {
      sessionStorage.removeItem('pipelineDealsCache');
      sessionStorage.removeItem('roomsCache');
    } catch (_) {}
  }, [profile?.id]);

  // Ensure profile exists to avoid redirect loops
  useEffect(() => {
    (async () => {
      if (!loading && profile && !triedEnsureProfileRef.current) {
        triedEnsureProfileRef.current = true;
        // Removed refresh() call - it causes loading loops
      }
    })();
  }, [loading, profile]);

  // One-time self-dedup to clean up any duplicates for this user
  useEffect(() => {
    (async () => {
      if (!loading && profile && !dedupRef.current) {
        dedupRef.current = true;
        try {
          await base44.functions.invoke('dedupeProfileByEmail');
          // Removed refresh() call - profile is already loaded
        } catch (e) {
          console.warn('profileDedupSelf failed', e);
        }
      }
    })();
  }, [loading, profile]);

  // Load identity status once for setup gating
  useEffect(() => {
    if (!profile?.id) return;
    (async () => {
      try {
        const { data } = await base44.functions.invoke('getIdentityStatus');
        setIdentity(data?.identity || null);
      } catch (e) {
        console.warn('[Pipeline] getIdentityStatus failed:', e);
        // Fallback: use profile data directly
        const fallbackIdentity = {
          verificationStatus: profile.identity_status === 'approved' || profile.identity_status === 'verified' 
            ? 'VERIFIED' 
            : profile.identity_status === 'pending' 
            ? 'PROCESSING' 
            : 'NOT_STARTED'
        };
        setIdentity(fallbackIdentity);
      } finally {
        setIdentityLoaded(true);
      }
    })();
  }, [profile?.id, profile?.identity_status]);

  // Auto-refresh identity while under review so the banner updates and hides when done
  useEffect(() => {
    if (!profile?.id) return;
    const isUnderReview = String(identity?.verificationStatus || '').toUpperCase() === 'PROCESSING';
    if (!isUnderReview) return;

    const interval = setInterval(async () => {
      try {
        const { data } = await base44.functions.invoke('getIdentityStatus');
        const status = String(data?.identity?.verificationStatus || '').toUpperCase();
        setIdentity(data?.identity || null);
        if (status === 'VERIFIED') {
          try { if (profile?.id) { await base44.entities.Profile.update(profile.id, { identity_status: 'approved', identity_verified_at: new Date().toISOString() }); } } catch (_) {}
          setIdentity({ verificationStatus: 'VERIFIED' });
          clearInterval(interval);
        }
      } catch (e) {
        // Fallback: check profile directly
        const updatedProfiles = await base44.entities.Profile.filter({ id: profile.id });
        const updatedProfile = updatedProfiles[0];
        if (updatedProfile?.identity_status === 'approved' || updatedProfile?.identity_status === 'verified') {
          setIdentity({ verificationStatus: 'VERIFIED' });
          clearInterval(interval);
        }
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [profile?.id, identity?.verificationStatus, profile?.identity_status, refresh]);

  // Backfill identity_status immediately once VERIFIED
  useEffect(() => {
    if (!profile?.id) return;
    const status = String(identity?.verificationStatus || '').toUpperCase();
    if (status === 'VERIFIED' && !(profile?.identity_status === 'approved' || profile?.identity_status === 'verified')) {
      (async () => {
        try {
          await base44.entities.Profile.update(profile.id, {
            identity_status: 'approved',
            identity_verified_at: new Date().toISOString(),
          });
          // Profile will update via realtime subscription
        } catch (_) {}
      })();
    }
  }, [profile?.id, profile?.identity_status, identity?.verificationStatus]);

  // Manual dedup handler (kept for logic, no UI trigger) 
  const handleDedup = async () => {
    if (!profile?.id) return;
    setDeduplicating(true);
    try {
      const response = await base44.functions.invoke('deduplicateDeals');
      if (response.data?.deletedCount > 0) {
        toast.success(`Removed ${response.data.deletedCount} duplicate deals`);
        // refetchDeals(); // avoid immediate reshuffle to reduce flicker
      } else {
        toast.success('No duplicates found');
      }
    } catch (e) {
      console.error("Deduplication error", e);
      toast.error('Failed to check for duplicates');
    }
    setDeduplicating(false);
  };

  // Valid US states and territories
  const validUSStates = new Set([
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC', 'PR', 'VI', 'GU', 'AS', 'MP',
    'ALABAMA', 'ALASKA', 'ARIZONA', 'ARKANSAS', 'CALIFORNIA', 'COLORADO',
    'CONNECTICUT', 'DELAWARE', 'FLORIDA', 'GEORGIA', 'HAWAII', 'IDAHO',
    'ILLINOIS', 'INDIANA', 'IOWA', 'KANSAS', 'KENTUCKY', 'LOUISIANA',
    'MAINE', 'MARYLAND', 'MASSACHUSETTS', 'MICHIGAN', 'MINNESOTA',
    'MISSISSIPPI', 'MISSOURI', 'MONTANA', 'NEBRASKA', 'NEVADA',
    'NEW HAMPSHIRE', 'NEW JERSEY', 'NEW MEXICO', 'NEW YORK',
    'NORTH CAROLINA', 'NORTH DAKOTA', 'OHIO', 'OKLAHOMA', 'OREGON',
    'PENNSYLVANIA', 'RHODE ISLAND', 'SOUTH CAROLINA', 'SOUTH DAKOTA',
    'TENNESSEE', 'TEXAS', 'UTAH', 'VERMONT', 'VIRGINIA', 'WASHINGTON',
    'WEST VIRGINIA', 'WISCONSIN', 'WYOMING'
  ]);

  // Detect user role
  const isAgent = profile?.user_role === 'agent';
  const isInvestor = profile?.user_role === 'investor';

  // Setup completion gating (must be 4/4)
  const onboardingComplete = Boolean(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version);
  const ndaComplete = !!profile?.nda_accepted;
  const brokerageComplete = Boolean(profile?.broker || profile?.agent?.brokerage);
  const identityComplete = Boolean(
    (identity && String(identity.verificationStatus || '').toUpperCase() === 'VERIFIED') ||
    (profile?.identity_status === 'approved' || profile?.identity_status === 'verified')
  );
  const investorSetupComplete = isInvestor ? (onboardingComplete && ndaComplete) : true;
  const agentSetupComplete = isAgent ? (onboardingComplete && brokerageComplete && ndaComplete && identityComplete) : true;

  // 2. Load Active Deals via Server-Side Access Control
    const { data: dealsData = [], isLoading: loadingDeals, isFetching: fetchingDeals, refetch: refetchDeals } = useQuery({
      queryKey: ['pipelineDeals', profile?.id, profile?.user_role],
      staleTime: isAgent ? 10_000 : 30_000, // Agents refresh more frequently (10s vs 30s)
      gcTime: 30 * 60_000,
     initialData: () => {
       try {
         if (!dealsCacheKey) return undefined;
         const cached = JSON.parse(sessionStorage.getItem(dealsCacheKey) || '[]');
         return Array.isArray(cached) && cached.length > 0 ? cached : undefined;
       } catch { return undefined; }
     },
     refetchOnMount: true,
     queryFn: async () => {
       if (!profile?.id) return [];

       // PRODUCTION: Server-side access control enforces role-based redaction
       const response = await base44.functions.invoke('getPipelineDealsForUser');
       const deals = response.data?.deals || [];

       // Deduplicate by ID on client side as well
       const dealsMap = new Map();
       deals
         .filter(d => d?.status !== 'archived')
         .forEach(d => {
           if (!d?.id) return;
           const existing = dealsMap.get(d.id);
           if (!existing || new Date(d.updated_date || 0) > new Date(existing.updated_date || 0)) {
             dealsMap.set(d.id, d);
           }
         });

       return Array.from(dealsMap.values())
         .sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
     },
     enabled: !!profile?.id,
     refetchOnWindowFocus: true,

   });

  useEffect(() => {
    try {
      if (Array.isArray(dealsData) && dealsCacheKey) {
        sessionStorage.setItem(dealsCacheKey, JSON.stringify(dealsData));
      }
    } catch (_) {}
  }, [dealsData, dealsCacheKey]);

  const uniqueDealsData = useMemo(() => {
    if (!Array.isArray(dealsData) || dealsData.length === 0) return [];

    const normalize = (v) => (v ?? '').toString().trim().toLowerCase();
    const toDate = (d) => new Date(d || 0).getTime();

    // Step 1: dedupe by exact id first (keep the most recently updated)
    const byId = new Map();
    for (const d of dealsData) {
      const id = d?.id || d?.deal_id;
      if (!id) continue;
      const prev = byId.get(id);
      if (!prev || toDate(d.updated_date || d.created_date) > toDate(prev.updated_date || prev.created_date)) {
        byId.set(id, d);
      }
    }

    // Step 2: dedupe by natural signature (address/title + city + state + zip + price)
    const makeSig = (d) => {
      const addr = normalize(d.property_address || d.deal_title || d.title);
      const city = normalize(d.city);
      const state = normalize(d.state);
      const zip = normalize(d.zip);
      const price = d.purchase_price ?? d.budget ?? '';
      return `${addr}|${city}|${state}|${zip}|${price}`;
    };

    const bySig = new Map();
    for (const d of byId.values()) {
      const sig = makeSig(d);
      const prev = bySig.get(sig);
      if (!prev || toDate(d.updated_date || d.created_date) > toDate(prev.updated_date || prev.created_date)) {
        bySig.set(sig, d);
      }
    }

    return Array.from(bySig.values());
  }, [dealsData]);

  // Load recent activity/notifications
  const { data: activities = [], isLoading: loadingActivities } = useQuery({
    queryKey: ['activities', profile?.id],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!profile?.id) return [];
      // Get all deals for this user
      const dealIds = uniqueDealsData.map(d => d.id);
      if (dealIds.length === 0) return [];
      
      // Get activities for these deals
      const allActivities = await base44.entities.Activity.list('-created_date', 20);
      return allActivities.filter(a => dealIds.includes(a.deal_id));
    },
    enabled: !!profile?.id && dealsData.length > 0,
    refetchOnWindowFocus: false,
    refetchInterval: 0 // Disable polling to avoid UI reshuffles
  });

  // 3. Load Rooms (to link agents/status)
    const { data: rooms = [], isLoading: loadingRooms, isFetching: fetchingRooms, refetch: refetchRooms } = useQuery({
      queryKey: ['rooms', profile?.id],
      staleTime: Infinity,
      gcTime: 30 * 60_000,
     initialData: () => {
       try {
         if (!roomsCacheKey) return undefined;
         const cached = JSON.parse(sessionStorage.getItem(roomsCacheKey) || '[]');
         return Array.isArray(cached) && cached.length > 0 ? cached : undefined;
       } catch { return undefined; }
     },
     refetchOnMount: 'stale',
     queryFn: async () => {
       if (!profile?.id) return [];
       const res = await base44.functions.invoke('listMyRoomsEnriched');
       return res.data?.rooms || [];
     },
     enabled: !!profile?.id,
     refetchOnWindowFocus: false,

   });

  useEffect(() => {
    try {
      if (Array.isArray(rooms) && roomsCacheKey) {
        sessionStorage.setItem(roomsCacheKey, JSON.stringify(rooms));
      }
    } catch (_) {}
  }, [rooms, roomsCacheKey]);

  // Force refresh after DocuSign return
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('signed') === '1') {
      (async () => {
        const dealId = params.get('dealId') || params.get('deal_id');
        if (dealId) {
          try {
            const { data } = await base44.functions.invoke('getLegalAgreement', { deal_id: dealId });
            const ag = data?.agreement;
            if (ag?.status === 'investor_signed' || (ag?.investor_signed_at && ag?.status !== 'fully_signed')) {
              const roomsForDeal = await base44.entities.Room.filter({ deal_id: dealId });
              if (Array.isArray(roomsForDeal)) {
                for (const r of roomsForDeal) {
                  try { await base44.entities.Room.update(r.id, { agreement_status: 'investor_signed' }); } catch (_) {}
                }
              }
            }
          } catch (_) {}
        }
        queryClient.invalidateQueries({ queryKey: ['rooms', profile?.id] });
        queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile?.id, profile?.user_role] });
        queryClient.invalidateQueries({ queryKey: ['activities', profile?.id] });
        refetchDeals();
        refetchRooms();
      })();
    }
  }, [location.search, profile?.id, profile?.user_role]);

  // Realtime: instantly refresh agent dashboard when investor signs or room updates
  useEffect(() => {
    if (!profile?.id || !isAgent) return;
    const unsubRoom = base44.entities.Room.subscribe((event) => {
      const r = event?.data;
      if (!r || r.agentId !== profile.id) return;
      console.log('[Pipeline] Room event for agent:', event.type, r.id, r.request_status, r.agreement_status);
      // Refresh on ANY room change for this agent
      if (event.type === 'create' || event.type === 'update') {
        try { 
          queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id, profile.user_role] }); 
          queryClient.invalidateQueries({ queryKey: ['rooms', profile.id] });
          refetchDeals();
          refetchRooms();
        } catch (_) {}
      }
    });
    
    // Also subscribe to LegalAgreement and DealInvite changes
    const unsubAgreement = base44.entities.LegalAgreement.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const ag = event?.data;
        console.log('[Pipeline] Agreement event:', event.type, ag?.status);
        if (ag?.investor_signed_at || ag?.status === 'investor_signed') {
          console.log('[Pipeline] Agreement update relevant to agent, refreshing...');
          try {
            queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id, profile.user_role] }); 
            queryClient.invalidateQueries({ queryKey: ['rooms', profile.id] });
            refetchDeals();
            refetchRooms();
          } catch (_) {}
        }
      }
    });
    
    const unsubInvite = base44.entities.DealInvite.subscribe((event) => {
      const invite = event?.data;
      if (!invite || invite.agent_profile_id !== profile.id) return;
      console.log('[Pipeline] DealInvite event for agent:', event.type, invite.status);
      if (event.type === 'create' || event.type === 'update') {
        try {
          queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id, profile.user_role] }); 
          queryClient.invalidateQueries({ queryKey: ['rooms', profile.id] });
          refetchDeals();
          refetchRooms();
        } catch (_) {}
      }
    });
    
    return () => { 
      try { unsubRoom && unsubRoom(); } catch (_) {} 
      try { unsubAgreement && unsubAgreement(); } catch (_) {}
      try { unsubInvite && unsubInvite(); } catch (_) {}
    };
  }, [profile?.id, profile?.user_role, isAgent, queryClient, refetchDeals, refetchRooms]);

  // Real-time: refresh deals when new ones are created or updated
  useEffect(() => {
    if (!profile?.id) return;
    const unsubDeal = base44.entities.Deal.subscribe((event) => {
      if (event?.type === 'create' || event?.type === 'update') {
        console.log('[Pipeline] Deal changed, refreshing...', event.type);
        try { 
          queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id, profile.user_role] }); 
          refetchDeals();
        } catch (_) {}
      }
    });
    return () => { try { unsubDeal && unsubDeal(); } catch (_) {} };
  }, [profile?.id, profile?.user_role, queryClient, refetchDeals]);

  // Real-time: refresh counter offers when they change
  useEffect(() => {
    if (!profile?.id || !isInvestor) return;
    const unsubCounter = base44.entities.CounterOffer.subscribe((event) => {
      console.log('[Pipeline] Counter offer event:', event.type);
      try { 
        queryClient.invalidateQueries({ queryKey: ['counterOffers'] });
        refetchCounters();
      } catch (_) {}
    });
    return () => { try { unsubCounter && unsubCounter(); } catch (_) {} };
  }, [profile?.id, isInvestor, queryClient]);

  // 4. Load Pending Requests (for agents)
  const { data: pendingRequests = [], isLoading: loadingRequests, isFetching: fetchingRequests } = useQuery({
    queryKey: ['pendingRequests', profile?.id],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!profile?.id || !isAgent) return [];
      const { data } = await base44.functions.invoke('getAgentPendingRequests');
      return data?.requests || [];
    },
    enabled: !!profile?.id && isAgent && allowExtras,
    refetchOnWindowFocus: false,
    
  });

  // 4b. Load Deal Appointments for visible deals
  const { data: appointments = [], isLoading: loadingAppointments } = useQuery({
    queryKey: ['dealAppointments', uniqueDealsData.map(d => d.id)],
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!uniqueDealsData || uniqueDealsData.length === 0) return [];
      const items = await base44.entities.DealAppointments.list('-updated_date', 500);
      const idSet = new Set(uniqueDealsData.map(d => d.id));
      return items.filter(a => idSet.has(a.dealId));
    },
    enabled: allowExtras && dealsData.length > 0,
    refetchOnWindowFocus: false,
    refetchInterval: 0
  });

  // 4c. Load Counter Offers for all deals (investor-only)
  const { data: counterOffers = [], isLoading: loadingCounters, refetch: refetchCounters } = useQuery({
    queryKey: ['counterOffers', uniqueDealsData.map(d => d.id)],
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      if (!uniqueDealsData || uniqueDealsData.length === 0 || !isInvestor) return [];
      const items = await base44.entities.CounterOffer.filter({ status: 'pending' }, '-created_date', 500);
      const idSet = new Set(uniqueDealsData.map(d => d.id));
      return items.filter(c => idSet.has(c.deal_id));
    },
    enabled: allowExtras && dealsData.length > 0 && isInvestor,
    refetchOnWindowFocus: false,
    refetchInterval: 0
  });



  

  // 5. Merge Data (no automatic dedup - user clicks button if needed)
  const deals = useMemo(() => {
    // Index rooms by deal_id
    const roomMap = new Map();
    const rank = (r) => r?.request_status === 'signed' ? 3 : r?.request_status === 'accepted' ? 2 : r?.request_status === 'requested' ? 1 : r?.request_status === 'rejected' ? -1 : 0;
    rooms.forEach(r => {
      if (!r?.deal_id) return;
      const current = roomMap.get(r.deal_id);
      if (!current || rank(r) > rank(current)) {
        roomMap.set(r.deal_id, r);
      }
    });

    // Index appointments by dealId
    const apptMap = new Map();
    (appointments || []).forEach(a => { if (a?.dealId) apptMap.set(a.dealId, a); });

    // Stable map to avoid reshuffles
    const mappedDeals = uniqueDealsData.map(deal => {
      const room = roomMap.get(deal.id);
      const appt = apptMap.get(deal.id);
      
      // Agent is accepted/signed if room status is accepted or signed
      const hasAgentAccepted = room?.request_status === 'accepted' || room?.request_status === 'signed';
      const hasAgentPending = room?.request_status === 'requested';
      const isFullySigned = (room?.agreement_status === 'fully_signed' || room?.request_status === 'signed' || deal.is_fully_signed === true);

      // Get agent name from Deal or Room
      let agentName = 'No Agent Selected';
      if (hasAgentAccepted) {
        const fullName = room?.counterparty_name || deal.agent_name || 'Agent Connected';
        // Hide agent name until both parties have fully signed
        agentName = isFullySigned ? fullName : isAgent ? 'Pending Investor Signature' : 'Pending Agent Signature';
      } else if (hasAgentPending) {
        agentName = isAgent ? 'Pending Your Review' : 'Pending Agent Review';
      }

      // For agents: show investor name. For investors: show agent name
      let counterpartyName = 'Not Assigned';
      if (isAgent) {
        // Hide investor name until fully signed
        if (isFullySigned) {
          counterpartyName = room?.counterparty_name || 'Investor';
        } else {
          counterpartyName = hasAgentAccepted || hasAgentPending ? 'Pending Agreement Signatures' : 'Investor';
        }
      } else {
        // For investors, agentName already hides real name until fully signed
        counterpartyName = agentName;
      }

      // If deal is fully signed but not in correct stage, update it
      if (isFullySigned && normalizeStage(deal.pipeline_stage || 'new_deals') !== 'connected_deals') {
        base44.entities.Deal.update(deal.id, { pipeline_stage: 'connected_deals' }).catch(() => {});
      }

      return {
          // IDs
          id: deal.id,
          deal_id: deal.id,
          room_id: room?.id || null,
          locked_room_id: deal.locked_room_id || null,
          locked_agent_id: deal.locked_agent_id || null,

          // Content - Prefer Deal Entity (User Uploaded Data)
           title: deal.title || 'Untitled Deal',
           property_address: deal.property_address || deal.deal_title || 'Address Pending',
           city: deal.city,
           state: deal.state,
           budget: deal.purchase_price, 
           seller_name: deal.seller_info?.seller_name,

           // Status & Agent  
           // Auto-move to connected_deals if agreement is fully signed, otherwise use deal's pipeline_stage
           pipeline_stage: isFullySigned ? 'connected_deals' : normalizeStage(deal.pipeline_stage || 'new_deals'),
           raw_pipeline_stage: deal.pipeline_stage,
           customer_name: counterpartyName,
           agent_id: deal.agent_id || room?.agentId || room?.counterparty_profile_id, 
           agent_request_status: room?.request_status || null,
           agreement_status: room?.agreement_status || deal.agreement_status || null,

           // Dates
           created_date: deal.created_date,
           updated_date: deal.updated_date,
           closing_date: deal.key_dates?.closing_date,
           walkthrough_date: appt?.walkthrough?.datetime || null,
           walkthrough_status: appt?.walkthrough?.status || null,

          // Privacy flags
          is_fully_signed: (room?.agreement_status === 'fully_signed' || room?.request_status === 'signed' || room?.internal_agreement_status === 'both_signed' || deal.is_fully_signed === true),

          is_orphan: !hasAgentAccepted && !hasAgentPending
        };
    });

    // Deduplicate mapped deals by natural signature, prefer fully-signed and most recent
    const norm = (v) => (v ?? '').toString().trim().toLowerCase();
    const mkSig = (d) => `${norm(d.property_address || d.title)}|${norm(d.city)}|${norm(d.state)}|${Number(d.budget || 0)}`;
    const bySig2 = new Map();
    for (const d of mappedDeals) {
      const sig = mkSig(d);
      const prev = bySig2.get(sig);
      const prevScore = prev ? ((prev.is_fully_signed ? 1 : 0) * 1e12 + new Date(prev.updated_date || prev.created_date || 0).getTime()) : -1;
      const curScore = ((d.is_fully_signed ? 1 : 0) * 1e12) + new Date(d.updated_date || d.created_date || 0).getTime();
      if (!prev || curScore >= prevScore) bySig2.set(sig, d);
    }
    const dedupMappedDeals = Array.from(bySig2.values());

    // PHASE 7: Agents filter - exclude expired and locked-to-other-agent
    return dedupMappedDeals.filter(d => {
      if (!isAgent) return true;
      
      // Exclude deals locked to a different agent
      if (d.locked_agent_id && d.locked_agent_id !== profile.id) {
        return false;
      }
      
      // Exclude only rejected and voided rooms
      if (d.agent_request_status === 'rejected' || d.agent_request_status === 'voided') return false;
      
      // Show ALL other deals (requested, accepted, signed, locked, expired, or null)
      return true;
    });
  }, [dealsData, rooms, appointments, profile?.id, isAgent]);

  const handleDealClick = async (deal) => {
    // Prefetch deal details and agreement for instant hydration
    if (deal?.deal_id) {
      base44.functions.invoke('getDealDetailsForUser', { dealId: deal.deal_id })
        .then((res) => { if (res?.data) setCachedDeal(deal.deal_id, res.data); })
        .catch(() => {});
    }

    // INVESTOR: Navigate to rooms or agreement page
    if (isInvestor) {
      try {
        const roomsForDeal = await base44.entities.Room.filter({ deal_id: deal.deal_id });
        if (roomsForDeal?.length > 0) {
          navigate(`${createPageUrl("Room")}?roomId=${roomsForDeal[0].id}`);
          return;
        }
      } catch (e) {
        console.error('[Pipeline] Failed to fetch rooms:', e);
      }

      // No rooms found - go to MyAgreement (it will handle signing or showing existing signature)
      navigate(`${createPageUrl("MyAgreement")}?dealId=${deal.deal_id}`);
      return;
    }

    // AGENT: Navigate to their specific room
    if (isAgent) {
      // If deal is locked, use locked room
      if (deal?.locked_room_id) {
        const masked = {
          id: deal.deal_id,
          title: `${deal.city || 'City'}, ${deal.state || 'State'}`,
          property_address: null,
          city: deal.city,
          state: deal.state,
          purchase_price: deal.budget,
          pipeline_stage: deal.pipeline_stage,
          key_dates: { closing_date: deal.closing_date },
          agent_id: deal.agent_id,
          is_fully_signed: false,
        };
        setCachedDeal(deal.deal_id, masked);
        navigate(`${createPageUrl("Room")}?roomId=${deal.locked_room_id}&tab=agreement`);
        return;
      }

      // Find agent's room for this deal
      if (deal?.room_id) {
        const masked = {
          id: deal.deal_id,
          title: `${deal.city || 'City'}, ${deal.state || 'State'}`,
          property_address: null,
          city: deal.city,
          state: deal.state,
          purchase_price: deal.budget,
          pipeline_stage: deal.pipeline_stage,
          key_dates: { closing_date: deal.closing_date },
          agent_id: deal.agent_id,
          is_fully_signed: false,
        };
        setCachedDeal(deal.deal_id, masked);
        navigate(`${createPageUrl("Room")}?roomId=${deal.room_id}&tab=agreement`);
        return;
      }

      // Check rooms list
      const existing = rooms.find(r => r.deal_id === deal.deal_id && !r.is_orphan);
      if (existing?.id) {
        const masked = {
          id: deal.deal_id,
          title: `${deal.city || 'City'}, ${deal.state || 'State'}`,
          property_address: null,
          city: deal.city,
          state: deal.state,
          purchase_price: deal.budget,
          pipeline_stage: deal.pipeline_stage,
          key_dates: { closing_date: deal.closing_date },
          agent_id: deal.agent_id,
          is_fully_signed: false,
        };
        setCachedDeal(deal.deal_id, masked);
        navigate(`${createPageUrl("Room")}?roomId=${existing.id}&tab=agreement`);
        return;
      }

      toast.error('Room not found for this deal');
    }
  };

  const handleStageChange = async (dealId, newStage) => {
    try {
      // Normalize stage before saving (ensure canonical ID)
      const normalizedNewStage = normalizeStage(newStage);

      await base44.entities.Deal.update(dealId, {
        pipeline_stage: normalizedNewStage
      });

      // Invalidate Dashboard caches to update counts immediately
      queryClient.invalidateQueries({ queryKey: ['investorDeals', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['pipelineDeals', profile.id] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });

      // Refetch local data (disabled to reduce flicker)
      // refetchDeals();
    } catch (error) {
      console.error('Failed to update stage:', error);
      toast.error('Failed to update stage');
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const dealId = draggableId;
    const newStage = normalizeStage(destination.droppableId); // Normalize before saving

    // Update the deal's pipeline stage
    await handleStageChange(dealId, newStage);
  };

  const formatCurrency = (val) => {
    if (!val) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getDaysInPipeline = (dateStr) => {
    if (!dateStr) return 'N/A';
    const days = Math.floor((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    return `${days}d`;
  };

  // Pipeline stages with icons
  // Memoize to keep column identity stable
  const pipelineStages = useMemo(() => PIPELINE_STAGES.filter(s => s.id !== 'canceled').map(stage => ({
    ...stage,
    icon: stage.id === 'new_deals' ? FileText :
          stage.id === 'connected_deals' ? CheckCircle :
          stage.id === 'active_listings' ? TrendingUp :
          stage.id === 'in_closing' ? Clock :
          stage.id === 'completed' ? CheckCircle :
          XCircle,
    label: stage.id === 'completed' ? 'Completed/Canceled' : stage.label
  })), []);

  // Precompute deals by stage to avoid per-render filtering and flicker
  const dealsByStage = useMemo(() => {
    const m = new Map();
    PIPELINE_STAGES.filter(s => s.id !== 'canceled').forEach(s => m.set(s.id, []));
    deals.forEach(d => {
      // PHASE 7: Agents - exclude expired and locked-to-other-agent deals
      if (isAgent) {
        const st = d.agreement_status;
        const rs = d.agent_request_status;
        
        // Exclude expired rooms
        if (rs === 'expired' || rs === 'rejected') return;
        
        // Exclude deals locked to a different agent
        if (d.locked_agent_id && d.locked_agent_id !== profile.id) return;
        
        const hasRequest = rs === 'requested' || rs === 'accepted' || rs === 'signed' || rs === 'locked';
        const hasSigning = d.is_fully_signed || st === 'investor_signed' || st === 'agent_signed' || st === 'attorney_review_pending';
        const allowed = hasRequest || hasSigning;
        if (!allowed) return;
      }
      const stage = d.pipeline_stage === 'canceled' ? 'completed' : d.pipeline_stage;
      const arr = m.get(stage) || [];
      arr.push(d);
      m.set(stage, arr);
    });
    return m;
  }, [deals, isAgent]);

  if (deduplicating) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[#808080]">Organizing your deals...</p>
        </div>
      </div>
    );
  }

  // Prevent initial flicker by waiting for profile to load
  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col">
        <Header profile={profile} />
        <div className="flex-1 overflow-auto px-6 py-6">
          <div className="max-w-[1800px] mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {[0,1,2].map((i) => (
                <div key={i} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-4 h-[400px]">
                  <div className="h-6 w-36 bg-[#1F1F1F] rounded mb-4" />
                  <div className="space-y-3">
                    {[0,1,2].map((j) => (
                      <div key={j} className="h-20 bg-[#141414] border border-[#1F1F1F] rounded-xl" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header profile={profile} />
      <div className="h-screen bg-transparent flex flex-col pt-4">
        <div className="flex-1 overflow-auto px-6 pb-6">
          <div className="max-w-[1800px] mx-auto">
            
            {/* Identity Reviewing Banner */}
            {identityLoaded && String(identity?.verificationStatus || '').toUpperCase() === 'PROCESSING' && (
              <div className="mb-6 bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-4 h-4 text-[#60A5FA]" />
                  <div>
                    <h2 className="text-sm font-semibold text-[#FAFAFA]">Reviewing your identity</h2>
                    <p className="text-xs text-[#808080]">Stripe is reviewing your verification. This usually takes a few minutes.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Setup Checklist */}
            {identityLoaded && ((isAgent && !agentSetupComplete) || (isInvestor && !investorSetupComplete)) && (
              <div className="mb-6">
                <SetupChecklist profile={profile} />
              </div>
            )}



            {/* Counter Offers Badge-Only Display - handled in AgreementPanel */}



            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-[#E3C567]">Dashboard</h1>
                <p className="text-sm text-[#808080] mt-1">Manage your deals across all stages</p>
              </div>

              {/* Recent Activity Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    const notifPanel = document.getElementById('notifications-panel');
                    notifPanel.classList.toggle('hidden');
                  }}
                  className="relative p-3 bg-[#0D0D0D] border border-[#1F1F1F] rounded-full hover:border-[#E3C567] transition-colors"
                >
                  <svg className="w-5 h-5 text-[#E3C567]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {activities.length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-[#E3C567] rounded-full"></span>
                  )}
                </button>

                {/* Notifications Panel */}
                <div
                  id="notifications-panel"
                  className="hidden absolute right-0 mt-2 w-96 bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl shadow-2xl z-50 max-h-[500px] overflow-hidden flex flex-col"
                >
                  <div className="p-4 border-b border-[#1F1F1F]">
                    <h3 className="text-lg font-bold text-[#E3C567]">Recent Activity</h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {activities.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-sm text-[#808080]">No recent activity</p>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#1F1F1F]">
                        {activities.map((activity) => {
                           const dealDisplay = deals.find(d => d.id === activity.deal_id);
                           if (!dealDisplay) return null;
                          const getIcon = () => {
                            switch (activity.type) {
                              case 'agent_locked_in':
                              case 'agent_accepted':
                                return <CheckCircle className="w-4 h-4 text-[#10B981]" />;
                              case 'message_sent':
                                return <MessageSquare className="w-4 h-4 text-[#60A5FA]" />;
                              case 'file_uploaded':
                                return <FileText className="w-4 h-4 text-[#F59E0B]" />;
                              case 'photo_uploaded':
                                return <svg className="w-4 h-4 text-[#DB2777]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
                              case 'deal_created':
                                return <Plus className="w-4 h-4 text-[#E3C567]" />;
                              default:
                                return <Circle className="w-4 h-4 text-[#808080]" />;
                            }
                          };

                          return (
                            <button
                              key={activity.id}
                              onClick={() => {
                                if (activity.room_id) {
                                  navigate(`${createPageUrl("Room")}?roomId=${activity.room_id}`);
                                }
                                document.getElementById('notifications-panel').classList.add('hidden');
                              }}
                              className="w-full p-4 hover:bg-[#141414] transition-colors text-left"
                            >
                              <div className="flex items-start gap-3">
                                <div className="w-8 h-8 bg-[#1F1F1F] rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                                  {getIcon()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-[#FAFAFA] mb-1">{activity.message}</p>
                                  {dealDisplay && (
                                    <p className="text-xs text-[#E3C567] mb-1 truncate">
                                      {isAgent && !dealDisplay.is_fully_signed
                                        ? `${dealDisplay.city || 'City'}, ${dealDisplay.state || 'State'}`
                                        : (dealDisplay.property_address || dealDisplay.title)}
                                    </p>
                                  )}
                                  <p className="text-xs text-[#808080]">
                                    {new Date(activity.created_date).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit'
                                    })}
                                  </p>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 ml-4 sm:ml-6">
                {(isInvestor && onboardingComplete && ndaComplete) && (
                  <Button 
                    onClick={() => {
                      try { sessionStorage.removeItem('newDealDraft'); } catch (_) {}
                      navigate(createPageUrl("NewDeal"));
                    }}
                    className="bg-[#E3C567] text-black hover:bg-[#D4AF37] rounded-full"
                  >
                    <Plus className="w-4 h-4 mr-2" /> New Deal
                  </Button>
                )}
                <Button
                  onClick={() => setHelpOpen(true)}
                  className="bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full"
                >
                  Tutorials
                </Button>
              </div>
            </div>

            {/* Kanban Grid with Drag & Drop */}
            <DragDropContext onDragEnd={handleDragEnd}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-8">
                {pipelineStages.map(stage => {
                  const stageDeals = dealsByStage.get(stage.id) || [];
                  const Icon = stage.icon;

                  return (
                    <div key={stage.id} className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-4 flex flex-col md:h-[400px] h-auto will-change-transform">
                      <button
                        onClick={() => navigate(`${createPageUrl("PipelineStage")}?stage=${stage.id}`)}
                        className="flex items-center gap-3 mb-4 pb-3 border-b border-[#1F1F1F] hover:opacity-80 transition-opacity w-full text-left"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#E3C567]/10 flex items-center justify-center text-[#E3C567]">
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <h3 className="text-[#FAFAFA] font-bold text-sm">{stage.label}</h3>
                          <p className="text-xs text-[#808080]">{stageDeals.length} deals</p>
                        </div>
                      </button>

                      <Droppable droppableId={stage.id}>
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.droppableProps}
                            className={`md:flex-1 md:overflow-y-auto space-y-3 pr-2 custom-scrollbar transition-colors ${
                              snapshot.isDraggingOver ? 'bg-[#E3C567]/5' : ''
                            }`}
                          >
                            {stageDeals.length === 0 ? (
                              <div className="h-full flex items-center justify-center text-[#333] text-sm">
                                {snapshot.isDraggingOver ? 'Drop here' : 'No deals'}
                              </div>
                            ) : (
                              stageDeals.map((deal, index) => (
                                <Draggable key={deal.id} draggableId={deal.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className={`bg-[#141414] border border-[#1F1F1F] p-4 rounded-xl hover:border-[#E3C567] group transition-all ${
                                        snapshot.isDragging ? 'shadow-2xl ring-2 ring-[#E3C567] opacity-90' : ''
                                      }`}
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-[#FAFAFA] font-bold text-sm line-clamp-2 leading-tight">
                                          {/* Role-based privacy: agents see city/state only until fully signed */}
                                          {isAgent && !deal.is_fully_signed
                                            ? `${deal.city}, ${deal.state}`
                                            : deal.property_address
                                          }
                                        </h4>
                                        <span className="text-[10px] bg-[#222] text-[#808080] px-2 py-0.5 rounded-full">
                                          {getDaysInPipeline(deal.created_date)}
                                        </span>
                                      </div>

                                      <div className="flex flex-col gap-2 mb-3">
                                        <div className="flex items-center gap-1 text-xs text-[#666]">
                                          <Home className="w-3 h-3" />
                                          <span>{deal.city}, {deal.state}</span>
                                        </div>
                                        {isAgent && (() => {
                                          const rawDeal = uniqueDealsData.find(d => d.id === deal.deal_id);
                                          const roomForDeal = rooms.find(r => r.deal_id === deal.deal_id);
                                          const { priceLabel, compLabel } = getPriceAndComp({ deal: rawDeal, room: roomForDeal });
                                          if (!priceLabel && !compLabel) return null;
                                          return (
                                            <div className="text-xs mt-1">
                                              {priceLabel && <div className="text-[#34D399] font-semibold">{priceLabel}</div>}
                                              {compLabel && <div className="text-[#E3C567] mt-0.5">Comp: {compLabel}</div>}
                                            </div>
                                          );
                                        })()}

                                        {deal.walkthrough_date && (
                                          <div className="flex items-center gap-1 text-xs text-[#60A5FA]">
                                            <Calendar className="w-3 h-3" />
                                            <span>Walkthrough: {new Date(deal.walkthrough_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}{deal.walkthrough_status === 'PROPOSED' ? ' (Proposed)' : ''}</span>
                                          </div>
                                        )}

                                        {/* Show seller name only for investors OR fully signed deals */}
                                        {(isInvestor || deal.is_fully_signed) && deal.seller_name && (
                                          <div className="text-xs text-[#808080]">
                                            Seller: {deal.seller_name}
                                          </div>
                                        )}

                                        {(() => {
                                         // Check if there's a pending counter offer for this deal
                                         const pendingCounter = counterOffers.find(c => c.deal_id === deal.deal_id && c.status === 'pending');
                                         if (pendingCounter && isInvestor) {
                                           return (
                                             <div className="mt-1">
                                               <span className="text-[10px] border border-[#F59E0B]/50 bg-[#F59E0B]/20 text-[#F59E0B] px-2 py-0.5 rounded-full animate-pulse">
                                                 ⚠️ Counter Offer Pending
                                               </span>
                                             </div>
                                           );
                                         }

                                         const fullRoom = rooms.find(r => r.deal_id === deal.deal_id) || { agreement_status: deal.agreement_status, is_fully_signed: deal.is_fully_signed };
                                         const badge = getAgreementStatusLabel({
                                           room: fullRoom,
                                           agreement: fullRoom?.agreement,
                                           negotiation: fullRoom?.negotiation,
                                           role: isAgent ? 'agent' : 'investor'
                                         });
                                         return badge ? (
                                           <div className="mt-1">
                                             <span className={`text-[10px] border px-2 py-0.5 rounded-full ${badge.className}`}>
                                               {badge.label}
                                             </span>
                                           </div>
                                         ) : null;
                                        })()}

                                        {!deal.is_orphan && deal.customer_name && (
                                          <div className="text-xs text-[#10B981] flex items-center gap-1">
                                            <CheckCircle className="w-3 h-3" />
                                            <span>{deal.customer_name}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Action Buttons */}
                                      <div className="flex gap-2 mt-3 pt-3 border-t border-[#1F1F1F]">
                                        {(!isAgent && deal.agent_request_status === 'rejected' && deal.agreement_status !== 'investor_signed' && deal.agreement_status !== 'fully_signed' && deal.agreement_status !== 'attorney_review_pending') ? (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(createPageUrl("AgentMatching") + `?dealId=${deal.deal_id}`);
                                            }}
                                            size="sm"
                                            className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs py-1.5 h-auto"
                                          >
                                            Match With New Agent
                                          </Button>
                                        ) : (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleDealClick(deal);
                                            }}
                                            size="sm"
                                            disabled={isAgent && !agentSetupComplete}
                                            className="flex-1 bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full text-xs py-1.5 h-auto disabled:opacity-60 disabled:cursor-not-allowed"
                                          >
                                            Open Deal Room
                                          </Button>
                                        )}
                                        {isInvestor && (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              navigate(`${createPageUrl("NewDeal")}?dealId=${deal.deal_id}`);
                                            }}
                                            size="sm"
                                            className="flex-1 bg-[#1A1A1A] hover:bg-[#222] text-[#FAFAFA] border border-[#1F1F1F] rounded-full text-xs py-1.5 h-auto"
                                          >
                                            Edit Deal
                                          </Button>
                                        )}
                                      </div>
                                      </div>
                                  )}
                                </Draggable>
                              ))
                            )}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>

            {/* Legal Footer Links */}
            <LegalFooterLinks />

          </div>
        </div>
      </div>
      <HelpPanel open={helpOpen} onOpenChange={setHelpOpen} />


    </>
  );
}



export default function Pipeline() {
  return (
    <AuthGuard requireAuth={true}>
      <PipelineContent />
    </AuthGuard>
  );
}