import React, { useMemo } from "react";
import { Mail, Phone, Building2, MapPin } from "lucide-react";

// Generate a deterministic "signature style" based on the name string
function getSignatureStyle(name) {
  if (!name) return {};
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  hash = Math.abs(hash);

  const fonts = [
    "'Brush Script MT', 'Segoe Script', cursive",
    "'Lucida Handwriting', 'Apple Chancery', cursive",
    "'Palatino Linotype', 'Book Antiqua', 'Palatino', serif",
    "'Georgia', 'Times New Roman', serif",
    "'Snell Roundhand', 'Palace Script MT', cursive",
  ];
  const slants = [-4, -2, 0, 2, 3];
  const sizes = ["1.6rem", "1.75rem", "1.5rem", "1.65rem", "1.85rem"];
  const weights = [400, 500, 600, 400, 500];
  const spacings = ["0.02em", "0.04em", "0.01em", "0.06em", "0.03em"];

  const idx = hash % fonts.length;
  return {
    fontFamily: fonts[idx],
    fontSize: sizes[(hash >> 3) % sizes.length],
    fontWeight: weights[(hash >> 5) % weights.length],
    fontStyle: "italic",
    letterSpacing: spacings[(hash >> 7) % spacings.length],
    transform: `rotate(${slants[(hash >> 9) % slants.length]}deg)`,
  };
}

export default function CounterpartyInfoBar({ counterparty }) {
  if (!counterparty) return null;

  const sigStyle = useMemo(() => getSignatureStyle(counterparty.name), [counterparty.name]);

  const items = [
    { icon: Mail, value: counterparty.email, href: counterparty.email ? `mailto:${counterparty.email}` : null },
    { icon: Phone, value: counterparty.phone, href: counterparty.phone ? `tel:${counterparty.phone}` : null },
    { icon: Building2, value: counterparty.company },
    { icon: MapPin, value: counterparty.company_address },
  ].filter(i => i.value);

  if (!counterparty.name && items.length === 0) return null;

  return (
    <div className="bg-[#0A0A0A] border-b border-[#1F1F1F] px-6 py-3 flex-shrink-0">
      <div className="flex flex-col items-center gap-1.5">
        {counterparty.name && (
          <span
            className="text-[#E3C567] select-none leading-tight inline-block"
            style={sigStyle}
          >
            {counterparty.name}
          </span>
        )}
        {items.length > 0 && (
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
        )}
      </div>
    </div>
  );
}