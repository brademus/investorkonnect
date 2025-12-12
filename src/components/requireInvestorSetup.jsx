/**
 * Setup Guard - Ensures investor has completed required setup steps
 * before allowing critical actions like uploading deals
 */

/**
 * Checks if investor profile has completed all required setup fields
 * @param {Object} params
 * @param {Object} params.profile - User profile object
 * @returns {Object} { ok: boolean, redirectTo?: string, message?: string }
 */
export async function requireInvestorSetup({ profile }) {
  if (!profile) {
    return {
      ok: false,
      redirectTo: 'PostAuth',
      message: 'Profile not found. Please log in again.'
    };
  }

  // ADMIN BYPASS: Admins can access everything
  const isAdmin = profile.role === 'admin';
  if (isAdmin) {
    return { ok: true };
  }

  // Priority order: Onboarding → KYC → NDA → Profile Fields
  // This ensures the user completes major steps before being asked for minor profile details

  // 1. Onboarding completion (HIGHEST PRIORITY)
  // Legacy account detection: if they have key profile fields filled, consider them onboarded
  const hasLegacyProfile = !!(
    profile.full_name && 
    profile.phone && 
    (profile.company || profile.investor?.company_name) &&
    (profile.target_state || profile.location || (profile.markets && profile.markets.length > 0))
  );

  const isOnboarded = !!(
    profile.onboarding_completed_at || 
    profile.onboarding_step === 'basic_complete' || 
    profile.onboarding_step === 'deep_complete' ||
    profile.onboarding_version ||
    hasLegacyProfile  // Consider legacy accounts with complete profiles as onboarded
  );

  if (!isOnboarded) {
    return {
      ok: false,
      redirectTo: 'InvestorOnboarding',
      message: 'Please complete onboarding first.'
    };
  }

  // 2. KYC verification (SECOND PRIORITY)
  if (profile.kyc_status !== 'approved') {
    return {
      ok: false,
      redirectTo: 'Verify',
      message: 'Complete identity verification before uploading a deal.'
    };
  }

  // 3. NDA acceptance (THIRD PRIORITY)
  if (!profile.nda_accepted) {
    return {
      ok: false,
      redirectTo: 'NDA',
      message: 'Please accept the NDA to continue.'
    };
  }

  // 4. Basic profile fields (LOWEST PRIORITY - only checked after major gates)
  const missingFields = [];

  if (!profile.full_name || profile.full_name.trim() === '') {
    missingFields.push('Full Name');
  }

  if (!profile.phone || profile.phone.trim() === '') {
    missingFields.push('Phone Number');
  }

  const hasCompany = profile.company || profile.investor?.company_name;
  if (!hasCompany) {
    missingFields.push('Company/Entity Name');
  }

  const hasMarket = profile.target_state || profile.location || (profile.markets && profile.markets.length > 0);
  if (!hasMarket) {
    missingFields.push('Target Market/State');
  }

  if (missingFields.length > 0) {
    return {
      ok: false,
      redirectTo: 'AccountProfile',
      message: `Please complete your profile: ${missingFields.join(', ')}`
    };
  }

  // All checks passed
  return { ok: true };
}