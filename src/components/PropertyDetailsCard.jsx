import React from "react";

export default function PropertyDetailsCard({ deal }) {
  const pd = deal?.property_details || {};
  const propertyType = deal?.property_type;

  const rows = [
    { label: "Property Type", value: propertyType },
    { label: "Beds", value: pd.beds != null ? String(pd.beds) : null },
    { label: "Baths", value: pd.baths != null ? String(pd.baths) : null },
    { label: "Square Feet", value: pd.sqft != null ? Number(pd.sqft).toLocaleString() : null },
    { label: "Year Built", value: pd.year_built != null ? String(pd.year_built) : null },
    { label: "Stories", value: pd.number_of_stories || null },
    { label: "Basement", value: pd.has_basement || null },
  ].filter(r => r.value && r.value !== "0");

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      <h4 className="text-lg font-semibold text-[#FAFAFA] mb-4">Property Details</h4>
      {rows.length === 0 ? (
        <p className="text-sm text-[#808080]">No property details provided yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {rows.map((row, idx) => (
            <div key={idx} className="flex items-center justify-between py-1.5 border-b border-[#1F1F1F] last:border-0">
              <span className="text-sm text-[#808080]">{row.label}</span>
              <span className="text-sm font-medium text-[#FAFAFA]">{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}