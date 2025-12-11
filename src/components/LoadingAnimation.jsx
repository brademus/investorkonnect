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
             // 1. Remove global background color
             delete data.sc; 
             
             // Helper to clean layers
             const cleanLayers = (layers) => {
                 if (!Array.isArray(layers)) return [];
                 return layers.filter(layer => {
                     const name = (layer.nm || '').toLowerCase();
                     const isSolid = layer.ty === 1; // Type 1 is Solid
                     const isShape = layer.ty === 4; // Type 4 is Shape
                     
                     // Remove ALL solid layers (usually backgrounds)
                     if (isSolid) return false;
                     
                     // Remove layers with suspicious names
                     if (name.includes('background') || name.includes('bg') || name.includes('solid') || name.includes('black') || name.includes('dark')) {
                         return false;
                     }
                     
                     // Specialized check: sometimes background is a full-screen shape layer
                     // If it's the very last layer (bottom-most) and looks like a rect, we might want to kill it,
                     // but that's risky. Relying on solids/names first.
                     
                     return true;
                 });
             };

             // 2. Clean root layers
             if (data.layers) {
                 data.layers = cleanLayers(data.layers);
             }

             // 3. Recursively clean precomps (assets)
             if (Array.isArray(data.assets)) {
                 data.assets.forEach(asset => {
                     if (asset.layers) {
                         asset.layers = cleanLayers(asset.layers);
                     }
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