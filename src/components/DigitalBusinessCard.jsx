import React from "react";
import { Mail, Phone, Building2, Briefcase } from "lucide-react";
import AgentRatingStars from "@/components/AgentRatingStars";
import { useAgentRating } from "@/components/useAgentRating";

export default function DigitalBusinessCard({ agentProfile, ikDealsCount }) {
  if (!agentProfile) return null;

  const { rating, reviewCount } = useAgentRating(agentProfile.id);
  const agent = agentProfile.agent || {};
  const name = agentProfile.full_name || "Agent";
  const email = agentProfile.email;
  const phone = agentProfile.phone || agent.phone;
  const brokerage = agent.brokerage || agentProfile.broker || agentProfile.company;
  const headshot = agentProfile.headshotUrl;
  const markets = agent.markets || agentProfile.markets || [];
  const investmentStrategies = agent.investment_strategies || [];
  const propertySpecialties = agent.specialties || [];
  const allSpecialties = [...new Set([...investmentStrategies, ...propertySpecialties])];

  // Generate initials for fallback
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <div className="bg-gradient-to-br from-[#0D0D0D] via-[#111] to-[#0D0D0D] border border-[#E3C567]/30 rounded-2xl overflow-hidden">
      {/* Gold accent bar */}
      <div className="h-1.5 bg-gradient-to-r from-[#E3C567] via-[#D4AF37] to-[#E3C567]" />

      <div className="p-8">
        {/* Top row: Photo + Name/Signature */}
        <div className="flex items-start gap-6 mb-8">
          {/* Profile photo */}
          <div className="w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 border-2 border-[#E3C567]/40 shadow-lg shadow-[#E3C567]/10">
            {headshot ? (
              <img src={headshot} alt={name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-[#E3C567]/20 flex items-center justify-center">
                <span className="text-2xl font-bold text-[#E3C567]">{initials}</span>
              </div>
            )}
          </div>

          {/* Name + Signature */}
          <div className="flex-1 pt-1">
            <p className="text-xs uppercase tracking-[0.2em] text-[#E3C567]/60 mb-1">Real Estate Professional</p>
            <h3 className="text-2xl font-bold text-[#FAFAFA] mb-1">{name}</h3>
            <div className="mb-2">
              <AgentRatingStars rating={rating} reviewCount={reviewCount} size="sm" />
            </div>
            {/* Generated signature */}
            <div className="inline-block">
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

          {brokerage && (
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-4 h-4 text-[#E3C567]" />
              </div>
              <span className="text-sm text-[#FAFAFA]/80">{brokerage}</span>
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

        {/* Specialties */}
        {allSpecialties.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#808080] mb-3">Specialties</p>
            <div className="flex flex-wrap gap-2">
              {allSpecialties.map((item, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-full bg-[#E3C567]/10 border border-[#E3C567]/30 text-[#E3C567] text-xs font-medium"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Deal stats */}
        {(agent.investment_deals_last_12m > 0 || (ikDealsCount != null && ikDealsCount > 0)) && (
          <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
            <p className="text-xs uppercase tracking-[0.15em] text-[#808080] mb-3">Deal History</p>
            <div className="flex gap-4">
              {agent.investment_deals_last_12m > 0 && (
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#1A1A1A]">
                  <Briefcase className="w-4 h-4 text-[#E3C567] flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold text-[#E3C567]">{agent.investment_deals_last_12m}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[#808080]">Investment Deals Outside IK</p>
                  </div>
                </div>
              )}
              {ikDealsCount != null && ikDealsCount > 0 && (
                <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-lg bg-[#0A0A0A] border border-[#E3C567]/20">
                  <img 
                    src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
                    alt="IK"
                    className="w-5 h-5 object-contain flex-shrink-0"
                  />
                  <div>
                    <p className="text-lg font-bold text-[#E3C567]">{ikDealsCount}</p>
                    <p className="text-[10px] uppercase tracking-wider text-[#808080]">Investor Konnect Deals</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Markets footer */}
        {markets.length > 0 && (
          <div className="mt-4 pt-4 border-t border-[#1F1F1F]">
            <p className="text-xs text-[#808080]">
              Serving: {markets.join(' · ')}
            </p>
          </div>
        )}
      </div>

      {/* Bottom gold accent */}
      <div className="h-1 bg-gradient-to-r from-transparent via-[#E3C567]/40 to-transparent" />
    </div>
  );
}