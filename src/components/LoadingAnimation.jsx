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

                     // If it's a shape layer (Type 4) and it's the LAST layer in the list (which is the background in AE)
                     // AND it's not named something obvious like "hand" or "icon"
                     // We can try to be aggressive here if requested.
                     // Since layers are processed in filter, we can't easily check index vs length during iteration cleanly without context.
                     // But we can check if it looks like a "Square" or "Rect" shape group inside? Too deep.
                     
                     // Alternative: Remove all Shape Layers that are NOT "Yellow" (color check hard in json)
                     // Or remove the very last layer of the ROOT composition if it is a Shape Layer.
                     // We will do that outside this helper for the root specifically.
                     
                     // Specialized check: sometimes background is a full-screen shape layer
                     // If it's the very last layer (bottom-most) and looks like a rect, we might want to kill it,
                     // but that's risky. Relying on solids/names first.
                     
                     return true;
                 });
             };

             // 2. Clean root layers
             if (data.layers) {
                 data.layers = cleanLayers(data.layers);
                 
                 // AGGRESSIVE: Remove the bottom-most layer if it's a Shape Layer (Type 4)
                 // In Lottie/AE, layers are top-to-bottom. Last element is the background.
                 if (data.layers.length > 0) {
                     const lastLayer = data.layers[data.layers.length - 1];
                     // If it's a shape layer (4) and not explicitly named "hand" (just in case)
                     if (lastLayer.ty === 4 && !(lastLayer.nm || '').toLowerCase().includes('hand')) {
                         console.log("Removing potential background shape layer:", lastLayer.nm);
                         data.layers.pop();
                     }
                 }
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