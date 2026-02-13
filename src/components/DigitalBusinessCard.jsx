import React from "react";
import { Mail, Phone, Building2, Briefcase, MapPin, DollarSign } from "lucide-react";

export default function DigitalBusinessCard({ agentProfile, deals = [] }) {
  if (!agentProfile) return null;

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
            <h3 className="text-2xl font-bold text-[#FAFAFA] mb-3">{name}</h3>
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

        {/* Deals */}
        {deals.length > 0 && (
          <div className="mt-6 pt-4 border-t border-[#1F1F1F]">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.15em] text-[#808080]">Deals</p>
              <span className="text-xs text-[#E3C567] font-semibold">{deals.length} total</span>
            </div>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {deals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#0A0A0A] border border-[#1A1A1A]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#E3C567]/10 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-3.5 h-3.5 text-[#E3C567]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[#FAFAFA]/90 truncate">{deal.property_address || deal.title || 'Untitled Deal'}</p>
                      <div className="flex items-center gap-2 text-xs text-[#808080]">
                        {deal.city && <span>{deal.city}{deal.state ? `, ${deal.state}` : ''}</span>}
                        {deal.purchase_price > 0 && (
                          <span className="text-[#E3C567]/70">${(deal.purchase_price / 1000).toFixed(0)}k</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium ${
                    deal.pipeline_stage === 'completed' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                    deal.pipeline_stage === 'ready_to_close' || deal.pipeline_stage === 'in_closing' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                    'bg-[#E3C567]/10 text-[#E3C567] border border-[#E3C567]/20'
                  }`}>
                    {(deal.pipeline_stage || 'active').replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
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