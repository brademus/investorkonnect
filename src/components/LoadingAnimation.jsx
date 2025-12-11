import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Cache in memory to avoid repeated fetches during session
let cachedAnimationData = null;

export default function LoadingAnimation({ className = "w-24 h-24" }) {
  const [animationData, setAnimationData] = useState(cachedAnimationData);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cachedAnimationData) {
      setAnimationData(cachedAnimationData);
      return;
    }

    const fetchAnimation = async () => {
      try {
        // Try to get from sessionStorage first
        const stored = sessionStorage.getItem('loading_animation_data');
        if (stored) {
          const parsed = JSON.parse(stored);
          cachedAnimationData = parsed;
          setAnimationData(parsed);
          return;
        }

        const response = await base44.functions.invoke('getLoadingAnimation');
        if (response.data && !response.data.error) {
          cachedAnimationData = response.data;
          setAnimationData(response.data);
          try {
            sessionStorage.setItem('loading_animation_data', JSON.stringify(response.data));
          } catch (e) {
            // Ignore quota errors
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error("Failed to load animation:", err);
        setError(true);
      }
    };

    fetchAnimation();
  }, []);

  if (!animationData || error) {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <Loader2 className="w-full h-full text-[#D3A029] animate-spin" />
        <p className="text-xs text-[#808080] mt-2 text-center sr-only">Loading...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Lottie animationData={animationData} loop={true} />
    </div>
  );
}