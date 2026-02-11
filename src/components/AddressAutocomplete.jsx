import React, { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { MapPin, Loader2 } from "lucide-react";
import _ from "lodash";

export default function AddressAutocomplete({ value, onChange, onSelect, placeholder, className }) {
  const [predictions, setPredictions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);
  const skipNextSearch = useRef(false);

  // Debounced search
  const searchRef = useRef(
    _.debounce(async (query) => {
      if (!query || query.trim().length < 3) {
        setPredictions([]);
        setShowDropdown(false);
        return;
      }
      setLoading(true);
      try {
        const res = await base44.functions.invoke('placesAutocomplete', {
          action: 'autocomplete',
          input: query,
        });
        const preds = res.data?.predictions || [];
        setPredictions(preds);
        setShowDropdown(preds.length > 0);
        setSelectedIndex(-1);
      } catch (e) {
        console.error('Autocomplete error:', e);
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 150)
  );

  useEffect(() => {
    return () => searchRef.current.cancel();
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    onChange(val);
    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }
    searchRef.current(val);
  };

  const handleSelectPrediction = async (prediction) => {
    setShowDropdown(false);
    setPredictions([]);
    skipNextSearch.current = true;
    onChange(prediction.description);

    try {
      const res = await base44.functions.invoke('placesAutocomplete', {
        action: 'details',
        place_id: prediction.place_id,
      });
      const data = res.data;
      if (data && onSelect) {
        onSelect({
          address: data.address || prediction.description,
          city: data.city || '',
          state: data.state || '',
          zip: data.zip || '',
          county: data.county || '',
        });
      }
    } catch (e) {
      console.error('Place details error:', e);
    }
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || predictions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, predictions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelectPrediction(predictions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        ref={inputRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={() => { if (predictions.length > 0) setShowDropdown(true); }}
        placeholder={placeholder || "Start typing an address..."}
        className={className}
        autoComplete="off"
      />
      {loading && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          <Loader2 className="w-4 h-4 text-[#808080] animate-spin" />
        </div>
      )}

      {showDropdown && predictions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-[#141414] border border-[#1F1F1F] rounded-xl shadow-2xl overflow-hidden">
          {predictions.map((pred, i) => (
            <button
              key={pred.place_id}
              type="button"
              onClick={() => handleSelectPrediction(pred)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 text-sm transition-colors ${
                i === selectedIndex
                  ? 'bg-[#E3C567]/15 text-[#E3C567]'
                  : 'text-[#FAFAFA] hover:bg-[#1F1F1F]'
              }`}
            >
              <MapPin className="w-4 h-4 text-[#808080] flex-shrink-0" />
              <span className="truncate">{pred.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}