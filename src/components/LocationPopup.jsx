import React, { useState, useEffect } from "react";
import { loadLocationsForState } from "@/utils/locations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, MapPin } from "lucide-react";

/**
 * Location Picker Popup
 * 
 * Shows after user clicks a state on the map
 * Allows selection of specific county/city or skip
 */
export default function LocationPopup({
  stateCode,
  stateName,
  onClose,
  onContinue,
}) {
  const [loading, setLoading] = useState(true);
  const [counties, setCounties] = useState([]);
  const [cities, setCities] = useState([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);

  // Load location data for state
  useEffect(() => {
    setLoading(true);
    loadLocationsForState(stateCode).then((locations) => {
      setCounties(locations.counties || []);
      setCities(locations.cities || []);
      setLoading(false);
    });
  }, [stateCode]);

  // Update search results when query changes
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const matches = [];

    // Search cities
    cities.forEach((city) => {
      if (city.toLowerCase().includes(q)) {
        matches.push({
          label: `${city}, ${stateCode}`,
          type: 'city',
          city: city,
          county: null
        });
      }
    });

    // Search counties
    counties.forEach((county) => {
      if (county.toLowerCase().includes(q)) {
        matches.push({
          label: `${county} County, ${stateCode}`,
          type: 'county',
          city: null,
          county: county
        });
      }
    });

    setResults(matches.slice(0, 8));
  }, [query, cities, counties, stateCode]);

  const handleSelect = (result) => {
    setSelected(result);
    setQuery(result.label);
    setResults([]);
  };

  const handleContinue = () => {
    onContinue({
      state: stateCode,
      stateName: stateName,
      city: selected?.city || null,
      county: selected?.county || null,
    });
  };

  const handleSkip = () => {
    onContinue({
      state: stateCode,
      stateName: stateName,
      city: null,
      county: null,
    });
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              <h2 className="text-2xl font-bold">
                {stateName}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-blue-100 text-sm">
            Where in {stateName} would you like to invest?
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-600">
              Loading locations...
            </div>
          ) : (
            <>
              {/* Search Input */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <Input
                  className="pl-10"
                  placeholder="Search for a city or county..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {/* Search Results */}
              {results.length > 0 && (
                <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto mb-4">
                  {results.map((result, idx) => (
                    <button
                      key={idx}
                      className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-b-0"
                      onClick={() => handleSelect(result)}
                    >
                      <div className="font-medium text-slate-900">
                        {result.label}
                      </div>
                      <div className="text-xs text-slate-500 capitalize">
                        {result.type}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Location */}
              {selected && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <div className="text-sm text-blue-900">
                    <strong>Selected:</strong> {selected.label}
                  </div>
                </div>
              )}

              {/* Quick Suggestions */}
              {!query && !selected && (
                <div className="mb-4">
                  <p className="text-sm text-slate-600 mb-2">Popular locations:</p>
                  <div className="flex flex-wrap gap-2">
                    {cities.slice(0, 3).map((city) => (
                      <button
                        key={city}
                        onClick={() => handleSelect({
                          label: `${city}, ${stateCode}`,
                          type: 'city',
                          city: city,
                          county: null
                        })}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-700 transition-colors"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="space-y-3">
                <Button
                  onClick={handleContinue}
                  disabled={!selected}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  Continue with {selected ? 'selection' : 'entire state'}
                </Button>

                <button
                  onClick={handleSkip}
                  className="w-full text-slate-600 hover:text-slate-900 text-sm font-medium"
                >
                  Skip - I'll specify later
                </button>
              </div>

              <p className="text-xs text-slate-500 text-center mt-4">
                You can always update this in your profile settings
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}