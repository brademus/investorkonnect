import React from "react";

export default function PropertyDetailsCard({ deal, inline = false }) {
  const pd = deal?.property_details || {};

  // Helpers
  const pick = (...vals) => vals.find(v => v !== undefined && v !== null);
  const toNumber = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number') return v;
    const m = String(v).match(/[0-9]+(?:\.[0-9]+)?/);
    return m ? parseFloat(m[0]) : null;
  };
  const toBoolean = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'boolean') return v;
    const s = String(v).trim().toLowerCase();
    if (["y","yes","true","t","1"].includes(s)) return true;
    if (["n","no","false","f","0"].includes(s)) return false;
    return null;
  };

  // Normalize possible field names from different sources
  const propertyType = deal?.property_type || pd.property_type || pd.type || deal?.propertyType || deal?.type || deal?.property_type_name || null;
  const beds = pd.beds ?? pd.bedrooms ?? pd.bedrooms_total ?? pd.bdrms ?? pd.bed ?? deal?.beds ?? deal?.bedrooms ?? deal?.bedrooms_total ?? null;
  const baths = pd.baths ?? pd.bathrooms ?? pd.bathrooms_total ?? pd.bathrooms_total_integer ?? pd.ba ?? pd.bath ?? deal?.baths ?? deal?.bathrooms ?? deal?.bathrooms_total ?? deal?.bathrooms_total_integer ?? null;
  const sqftRaw = pd.sqft ?? pd.square_feet ?? pd.squareFeet ?? pd.square_footage ?? pd.living_area ?? pd.gross_living_area ?? deal?.sqft ?? deal?.square_feet ?? deal?.square_footage ?? null;
  const yearBuilt = pd.year_built ?? pd.yearBuilt ?? pd.built_year ?? deal?.year_built ?? deal?.yearBuilt ?? null;
  const stories = pd.number_of_stories ?? pd.stories ?? pd.floors ?? deal?.number_of_stories ?? deal?.stories ?? deal?.levels ?? null;

  // Sanitize sqft to a number if it's a formatted string
  const sqftVal = typeof sqftRaw === 'string' ? parseInt(sqftRaw.replace(/[^0-9]/g, ''), 10) : sqftRaw;

  let hasBasement = pd.has_basement ?? pd.basement ?? pd.hasBasement ?? pd.basement_yn ?? deal?.has_basement ?? deal?.basement ?? deal?.basement_yn ?? null;
  if (typeof hasBasement === 'string') {
    const s = hasBasement.toLowerCase();
    if (['yes', 'true', 'y'].includes(s)) hasBasement = true;
    else if (['no', 'false', 'n'].includes(s)) hasBasement = false;
  }

  // Walkthrough — use raw date/time strings from deal (single source of truth)
  const wtDate = deal?.walkthrough_date || null;
  const wtTime = deal?.walkthrough_time || null;
  const hasWalkthrough = deal?.walkthrough_scheduled === true && (wtDate || wtTime);
  let walkthroughLabel = null;
  if (hasWalkthrough) {
    const parts = [wtDate, wtTime].filter(Boolean);
    walkthroughLabel = parts.length > 0 ? parts.join(' at ') : 'Scheduled (date TBD)';
  }

  const rows = [
    { label: "Property Type", value: propertyType },
    { label: "Bedrooms", value: beds != null ? String(beds) : null },
    { label: "Bathrooms", value: baths != null ? String(baths) : null },
    { label: "Square Footage", value: (typeof sqftVal === 'number' && !isNaN(sqftVal)) ? sqftVal.toLocaleString() : null },
    { label: "Year Built", value: yearBuilt != null ? String(yearBuilt) : null },
    { label: "Stories", value: stories || null },
    { label: "Basement", value: (hasBasement === true ? 'Yes' : (hasBasement === false ? 'No' : null)) },
    { label: "Walk-through", value: walkthroughLabel },
  ].filter(r => r.value !== null && r.value !== undefined && String(r.value).trim() !== "");

  const content = (
    <>
      <h4 className={`font-semibold text-[#FAFAFA] ${inline ? 'text-base mb-3' : 'text-lg mb-4'}`}>Property Details</h4>
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
      {deal?._is_redacted && (
        <div className="mt-4 text-xs text-[#808080]">
          <span>Address hidden until agreement is fully signed</span>
        </div>
      )}
    </>
  );

  if (inline) {
    return <div className="border-t border-[#1F1F1F] pt-5">{content}</div>;
  }

  return (
    <div className="bg-[#0D0D0D] border border-[#1F1F1F] rounded-2xl p-6">
      {content}
    </div>
  );
}