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
             
             // Recursive function to clean a composition (root or precomp)
             const processComposition = (layers) => {
                 if (!Array.isArray(layers)) return [];

                 // 1. Filter out known background types/names
                 let cleaned = layers.filter(layer => {
                     const name = (layer.nm || '').toLowerCase();
                     const isSolid = layer.ty === 1; // Solid
                     
                     // Remove Solids
                     if (isSolid) return false;
                     
                     // Remove Suspicious Names
                     if (name.includes('background') || name.includes('bg') || name.includes('solid') || name.includes('black') || name.includes('dark')) {
                         return false;
                     }
                     return true;
                 });

                 // 2. Aggressively remove the bottom-most layer if it looks like a background
                 // (Shape layer or Image layer at the bottom, unless named 'hand' or 'logo')
                 if (cleaned.length > 0) {
                     const lastLayer = cleaned[cleaned.length - 1];
                     const name = (lastLayer.nm || '').toLowerCase();
                     const isShape = lastLayer.ty === 4;
                     const isImage = lastLayer.ty === 2;

                     // Safety check: Don't delete if it seems to be a main element
                     const isSafe = name.includes('hand') || name.includes('logo') || name.includes('icon') || name.includes('main');

                     if (!isSafe && (isShape || isImage)) {
                         // Double check: if it's the ONLY layer, maybe keep it? 
                         // But if it's a black box, we want it gone. 
                         // Assuming the hands are multiple layers or a precomp.
                         // Only pop if we have > 1 layer, OR if the layer is explicitly weird?
                         // Let's just pop it if it's shape/image and not safe.
                         console.log("Removing aggressive background layer:", name);
                         cleaned.pop();
                     }
                 }
                 
                 return cleaned;
             };

             // 2. Clean root layers
             if (data.layers) {
                 data.layers = processComposition(data.layers);
             }

             // 3. Recursively clean precomps (assets)
             if (Array.isArray(data.assets)) {
                 data.assets.forEach(asset => {
                     if (asset.layers) {
                         asset.layers = processComposition(asset.layers);
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