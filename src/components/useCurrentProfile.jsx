import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// ── Shared empty state shape ──
const EMPTY_STATE = {
  loading: true, user: null, profile: null, role: null,
  onboarded: false, needsOnboarding: false,
  kycStatus: 'unverified', kycVerified: false, needsKyc: false,
  hasNDA: false, needsNda: false, isInvestorReady: false,
  hasRoom: false, targetState: null,
  subscriptionPlan: 'none', subscriptionStatus: 'none', isPaidSubscriber: false,
  error: null
};

// ── Global cache ──
let globalProfileCache = null;
let globalCacheTimestamp = 0;
const CACHE_DURATION = 30000;
const SESSION_KEY = '__ik_profile_cache';

function persistCache(state) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ state, ts: Date.now() })); } catch (_) {}
}
function loadPersistedCache() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const { state, ts } = JSON.parse(raw);
    if (state && ts && (Date.now() - ts) < 120000) return { state, ts };
  } catch (_) {}
  return null;
}

// Hydrate from sessionStorage on module init
if (!globalProfileCache) {
  const persisted = loadPersistedCache();
  if (persisted) { globalProfileCache = persisted.state; globalCacheTimestamp = persisted.ts; }
}

// Safari BFCache listener
if (typeof window !== 'undefined' && !window.__PROFILE_BFCACHE_LISTENER__) {
  window.__PROFILE_BFCACHE_LISTENER__ = true;
  window.addEventListener('pageshow', (e) => { if (e.persisted) globalCacheTimestamp = 0; });
}

/**
 * CANONICAL PROFILE HOOK
 */
export function useCurrentProfile() {
  const [state, setState] = useState(() =>
    (globalProfileCache && globalProfileCache.user) ? globalProfileCache : EMPTY_STATE
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    const set = (s) => { if (mounted) setState(s); };

    const loadProfile = async () => {
      if (globalProfileCache && (Date.now() - globalCacheTimestamp) < CACHE_DURATION) {
        set(globalProfileCache);
        return;
      }

      try {
        const user = await base44.auth.me();
        if (!mounted) return;

        if (!user) {
          const s = { ...EMPTY_STATE, loading: false };
          globalProfileCache = s; globalCacheTimestamp = Date.now();
          set(s);
          return;
        }

        // Profile lookup by user_id (indexed, fast)
        let profile = null;
        try {
          const p = await base44.entities.Profile.filter({ user_id: user.id });
          profile = p[0] || null;
        } catch (_) {}

        if (!mounted) return;

        const isAdmin = user.role === 'admin' || profile?.role === 'admin';
        const isTeamMember = !!profile?.team_owner_id;

        // Role
        let role = profile?.user_role || profile?.user_type
          || (profile?.onboarding_version?.startsWith('agent') ? 'agent' : profile?.onboarding_version ? 'investor' : null)
          || user.role || 'member';
        if (isAdmin) role = 'admin';
        else if (role !== 'investor' && role !== 'agent') role = 'member';

        // Team members bypass all onboarding/subscription/KYC/NDA gates
        const bypassGates = isAdmin || isTeamMember;

        // Onboarding
        const hasLegacy = !!(profile?.full_name && profile?.phone && (profile?.company || profile?.investor?.company_name));
        const onboarded = bypassGates || !!(profile?.onboarding_completed_at || profile?.onboarding_step === 'basic_complete' || profile?.onboarding_step === 'deep_complete' || profile?.onboarding_version || hasLegacy);

        // Subscription
        const subscriptionStatus = profile?.subscription_status || 'none';
        const isPaidSubscriber = bypassGates || subscriptionStatus === 'active' || subscriptionStatus === 'trialing';

        // KYC
        const kycStatus = bypassGates ? 'approved' : (profile?.kyc_status || profile?.identity_status || 'unverified');
        const kycVerified = bypassGates || kycStatus === 'approved' || kycStatus === 'verified' || !!profile?.identity_verified_at;

        // NDA
        const hasNDA = bypassGates || !!profile?.nda_accepted;

        const finalState = {
          loading: false, user, profile, role, onboarded,
          needsOnboarding: !isAdmin && (role === 'investor' || role === 'agent') && !onboarded,
          kycStatus, kycVerified,
          needsKyc: !isAdmin && onboarded && (role === 'agent' || isPaidSubscriber) && !kycVerified,
          hasNDA, needsNda: !isAdmin && onboarded && kycVerified && !hasNDA,
          isInvestorReady: isAdmin || (role === 'investor' && onboarded && isPaidSubscriber && kycVerified && hasNDA),
          hasRoom: false,
          targetState: profile?.target_state || profile?.markets?.[0] || null,
          subscriptionPlan: profile?.subscription_tier || 'none',
          subscriptionStatus, isPaidSubscriber,
          needsSubscription: !isAdmin && role === 'investor' && onboarded && !isPaidSubscriber,
          teamOwnerId: profile?.team_owner_id || null,
          isTeamMember: !!profile?.team_owner_id,
          error: null
        };

        globalProfileCache = finalState;
        globalCacheTimestamp = Date.now();
        persistCache(finalState);
        set(finalState);

      } catch (error) {
        if (globalProfileCache) { set(globalProfileCache); return; }
        if (!mounted) return;
        set({ ...EMPTY_STATE, loading: false, error: error.message || 'Profile load failed' });
      }
    };

    loadProfile();
    return () => { mounted = false; };
  }, [refreshTrigger]);

  const refresh = () => {
    globalProfileCache = null; globalCacheTimestamp = 0;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
    setRefreshTrigger(prev => prev + 1);
  };

  return { ...state, refresh };
}

export default useCurrentProfile;