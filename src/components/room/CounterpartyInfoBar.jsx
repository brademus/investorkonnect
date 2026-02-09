import React from "react";
import { Mail, Phone, Building2, MapPin } from "lucide-react";

export default function CounterpartyInfoBar({ counterparty }) {
  if (!counterparty) return null;

  const items = [
    { icon: Mail, value: counterparty.email, href: counterparty.email ? `mailto:${counterparty.email}` : null },
    { icon: Phone, value: counterparty.phone, href: counterparty.phone ? `tel:${counterparty.phone}` : null },
    { icon: Building2, value: counterparty.company },
    { icon: MapPin, value: counterparty.company_address },
  ].filter(i => i.value);

  if (items.length === 0) return null;

  return (
    <div className="bg-[#0A0A0A] border-b border-[#1F1F1F] px-6 py-2.5 flex-shrink-0">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 justify-center">
        {items.map((item, i) => {
          const Icon = item.icon;
          const content = (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#AAAAAA]">
              <Icon className="w-3 h-3 text-[#E3C567] flex-shrink-0" />
              <span className="truncate max-w-[220px]">{item.value}</span>
            </span>
          );
          return item.href ? (
            <a key={i} href={item.href} className="hover:text-[#E3C567] transition-colors">{content}</a>
          ) : (
            <span key={i}>{content}</span>
          );
        })}
      </div>
    </div>
  );
}