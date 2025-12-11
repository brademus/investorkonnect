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
             delete data.sc; 
             
             // Aggressively remove background layers
             if (Array.isArray(data.layers)) {
                data.layers = data.layers.filter(layer => {
                   const name = (layer.nm || '').toLowerCase();
                   const isSolid = layer.ty === 1; // Type 1 is Solid
                   
                   // Remove ALL solid layers (usually backgrounds)
                   if (isSolid) return false;
                   
                   // Remove layers explicitly named background/bg/solid/dark/black
                   if (name.includes('background') || name.includes('bg') || name.includes('solid') || name.includes('black') || name.includes('dark')) {
                       return false;
                   }
                   
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
        style={{ background: 'transparent' }}
        rendererSettings={{ preserveAspectRatio: 'xMidYMid slice', clearCanvas: true }}
      />
    </div>
  );
}