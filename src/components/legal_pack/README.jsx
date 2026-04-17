# InvestorKonnect Legal Pack v1.0.1

## Overview
This directory contains the immutable legal specification pack for contract generation.

## Files
- `legal_engine_config.json` - Net policy, NJ timing, overlays, hard blocks
- `legal_clauses.json` - Clause bank with dependencies
- `deep_dive_modules.json` - State-specific deep-dive modules (IL, PA, NJ)
- `templates.json` - Master agreement and addendum chassis templates
- `terms_schema.json` - Exhibit A JSON schema

## Version Management
To upgrade to a new version:
1. Create a new version folder (e.g., components/legal_pack_v1_0_2/)
2. Update imports in components/services/legalEngine/loadPack.ts
3. Update LegalAgreement.agreement_version default value
4. Test thoroughly before deploying

## Usage
Legal pack is loaded via singleton cache in `loadPack.ts`.
All contract generation flows use this as the single source of truth.

## Notes
- ZIP code mapping drives city overlay detection (not free-text city)
- NJ attorney review: 3 business days, Day 0 = delivery, weekends excluded
- IL hard block: unlicensed + >1 deal in 365 days = blocked
- Net policy: BANNED (IL, NY), RESTRICTED (TX, CA), ALLOWED (others)