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

  // Check required fields for investor setup
  const missingFields = [];

  // 1. Basic profile info
  if (!profile.full_name || profile.full_name.trim() === '') {
    missingFields.push('Full Name');
  }

  if (!profile.phone || profile.phone.trim() === '') {
    missingFields.push('Phone Number');
  }

  // 2. Company/Entity info
  const hasCompany = profile.company || profile.investor?.company_name;
  if (!hasCompany) {
    missingFields.push('Company/Entity Name');
  }

  // 3. Target market/state
  const hasMarket = profile.target_state || profile.location || (profile.markets && profile.markets.length > 0);
  if (!hasMarket) {
    missingFields.push('Target Market/State');
  }

  // 4. KYC verification
  if (profile.kyc_status !== 'approved') {
    return {
      ok: false,
      redirectTo: 'Verify',
      message: 'Complete identity verification before uploading a deal.'
    };
  }

  // 5. NDA acceptance
  if (!profile.nda_accepted) {
    return {
      ok: false,
      redirectTo: 'NDA',
      message: 'Please accept the NDA to continue.'
    };
  }

  // 6. Onboarding completion
  const isOnboarded = !!(
    profile.onboarding_completed_at || 
    profile.onboarding_step === 'basic_complete' || 
    profile.onboarding_step === 'deep_complete' ||
    profile.onboarding_version
  );

  if (!isOnboarded) {
    return {
      ok: false,
      redirectTo: 'InvestorOnboarding',
      message: 'Please complete onboarding first.'
    };
  }

  // If any basic fields are missing, redirect to profile setup
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