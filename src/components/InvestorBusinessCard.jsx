import React from "react";
import { Mail, Phone, Building2, MapPin, Target, Briefcase } from "lucide-react";

export default function InvestorBusinessCard({ investorProfile, ikDealsCount }) {
  if (!investorProfile) return null;

  const inv = investorProfile.investor || {};
  const meta = investorProfile.metadata || {};
  const ob = { ...meta, ...(investorProfile.onboarding || {}), ...(meta.basicProfile || {}), ...(investorProfile.onboarding || {}) };

  const name = investorProfile.full_name || "Investor";
  const email = investorProfile.email;
  const phone = investorProfile.phone;
  const company = inv.company_name || investorProfile.company;
  const headshot = investorProfile.headshotUrl;
  const markets = investorProfile.markets || [];
  const targetState = investorProfile.target_state;

  const strategies = ob.strategies || ob.deal_types || [];
  const assetTypes = ob.asset_types || [];
  const allTags = [...new Set([...strategies, ...assetTypes])];

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  // Experience label
  const expLabels = {
    new: "New Investor",
    few_deals: "Experienced",
    full_time: "Full-time Investor",
    family_office: "Family Office / Fund"
  };
  const experienceLabel = expLabels[ob.investor_description];

  return (
    <div className="bg-gradient-to-br from-[#0D0D0D] via-[#111] to-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl overflow-hidden">
      {/* Gold accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#E3C567] via-[#D4AF37] to-[#E3C567]" />

      <div className="p-8">
        {/* Top row: Photo + Name */}
        <div className="flex items-start gap-6 mb-8">
          <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#E3C567]/40 shadow-lg shadow-[#E3C567]/10">
            {headshot ? (
              <img src={headshot} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#E3C567]/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-[#E3C567]">{initials}</span>
              </div>
            )}
          </div>

          <div className="flex-1 pt-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[#E3C567]/60 mb-1">Real Estate Investor</p>
            <h3 className="text-2xl font-bold text-[#FAFAFA] mb-1">{name}</h3>
            {experienceLabel && (
              <span className="inline-block px-3 py-1 rounded-full bg-[#E3C567]/10 border border-[#E3C567]/30 text-[#E3C567] text-xs font-medium mb-2">
                {experienceLabel}
              </span>
            )}
            {/* Signature */}
            <div className="inline-block mt-1">
              <p
                className="text-[#E3C567] text-2xl italic leading-tight"
                style={{ fontFamily: "'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive" }}
              >
                {name}
              </p>
              <div className="h-px bg-gradient-to-r from-[#E3C567]/60 to-transparent mt-1 w-full" />
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-[#1F1F1F] mb-6" />

        {/* Contact details */}
        <div className="space-y-3">
          {email && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                <Mail className="w-4 h-4 text-[#E3C567]" />
              </div>
              <span className="text-sm text-[#FAFAFA]/80">{email}</span>
            </div>
          )}

          {company && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[#E3C567]" />
              </div>
              <span className="text-sm text-[#FAFAFA]/80">{company}</span>
            </div>
          )}

          {phone && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                <Phone className="w-4 h-4 text-[#E3C567]" />
              </div>
              <span className="text-sm text-[#FAFAFA]/80">{phone}</span>
            </div>
          )}
        </div>

        {/* Bio */}
        {(inv.bio || investorProfile.bio || investorProfile.goals) && (
          <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#808080] mb-2">About</p>
            <p className="text-sm text-[#FAFAFA]/80 leading-relaxed whitespace-pre-wrap">{inv.bio || investorProfile.bio || investorProfile.goals}</p>
          </div>
        )}

        {/* Markets & Geography */}
        {(targetState || markets.length > 0) && (
          <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="w-4 h-4 text-[#E3C567]" />
              <p className="text-xs uppercase tracking-[0.15em] text-[#808080]">Markets & Geography</p>
            </div>
            <div className="space-y-2">
              {targetState && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#808080]">Primary State</span>
                  <span className="text-sm text-[#FAFAFA]/80">{targetState}</span>
                </div>
              )}
              {markets.length > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#808080]">Target Markets</span>
                  <span className="text-sm text-[#FAFAFA]/80">{markets.join(", ")}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Experience & Background */}
        {(ob.investment_experience || ob.investor_description || ikDealsCount != null) && (
          <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
            <div className="flex items-center gap-2 mb-3">
              <Briefcase className="w-4 h-4 text-[#E3C567]" />
              <p className="text-xs uppercase tracking-[0.15em] text-[#808080]">Experience & Background</p>
            </div>
            <div className="flex gap-4">
              {ob.investment_experience && (
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#1A1A1A]">
                  <Briefcase className="w-4 h-4 text-[#E3C567] flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-[#E3C567]">{ob.investment_experience}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[#808080]">Total Deals Outside IK</p>
                  </div>
                </div>
              )}
              <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#E3C567]/20">
                <img 
                  src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
                  alt="IK"
                  className="w-5 h-5 object-contain flex-shrink-0"
                />
                <div>
                  <p className="text-lg font-bold text-[#E3C567]">{ikDealsCount ?? 0}</p>
                  <p className="text-[10px] uppercase tracking-wider text-[#808080]">Investor Konnect Deals</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Investment Strategy */}
        {allTags.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4 text-[#E3C567]" />
              <p className="text-xs uppercase tracking-[0.15em] text-[#808080]">Investment Strategy</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {allTags.map((item, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-full bg-[#E3C567]/10 border border-[#E3C567]/30 text-[#E3C567] text-xs font-medium"
                >
                  {item.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom gold accent */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#E3C567]/40 to-transparent" />
    </div>
  );
}