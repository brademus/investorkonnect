import React, { useEffect, useState } from 'react';
import Lottie from 'lottie-react';
import { base44 } from '@/api/base44Client';

// Global cache to avoid re-fetching
let cachedAnimationData = null;
let fetchPromise = null;

export default function LoadingAnimation({ className = "" }) {
  const [animationData, setAnimationData] = useState(cachedAnimationData);

  useEffect(() => {
    if (cachedAnimationData) {
      setAnimationData(cachedAnimationData);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = base44.functions.invoke('getLoadingAnimation')
        .then(res => {
          // Process data to remove background
          const data = res.data;
          if (data) {
             // Remove solid color background property if exists
             if (data.sc) delete data.sc; 
             
             // Try to find and remove background layers
             // In Lottie, layers are ordered top-to-bottom. Background is usually at the bottom (last index) or explicit.
             if (Array.isArray(data.layers)) {
                data.layers = data.layers.filter(layer => {
                   const name = (layer.nm || '').toLowerCase();
                   // Common names for backgrounds in After Effects
                   const isBackgroundName = name.includes('bg') || name.includes('background') || name.includes('solid') || name.includes('color');
                   // Type 1 is Solid
                   const isSolid = layer.ty === 1; 
                   
                   // If it's a solid layer, it's likely a background, especially if named so
                   if (isSolid) return false;
                   
                   // If explicit background name
                   if (isBackgroundName && isSolid) return false;
                   
                   return true;
                });
             }
          }
          cachedAnimationData = data;
          return data;
        })
        .catch(err => {
          console.error("Failed to load animation", err);
          return null;
        });
    }

    fetchPromise.then(data => {
      if (data) setAnimationData(data);
    });
  }, []);

  // Default size if not provided
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
  if (!animationData) {
    // Fallback pulse while loading - minimal/transparent
    return <div className={`animate-pulse opacity-0 ${sizeClass} ${className}`} />;
  }
  
  return (
    <div className={`flex items-center justify-center bg-transparent ${sizeClass} ${className}`}>
      <Lottie 
        animationData={animationData} 
        loop={true} 
        className="w-full h-full"
      />
    </div>
  );
}