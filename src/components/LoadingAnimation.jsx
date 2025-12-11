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
          const data = res.data;
          if (data) {
             // Remove global background color
             delete data.sc; 
             data.bg = undefined;
             
             // ULTRA AGGRESSIVE: Only keep layers with "hand" in the name
             const keepOnlyHands = (layers) => {
                 if (!Array.isArray(layers)) return [];
                 return layers.filter(layer => {
                     const name = (layer.nm || '').toLowerCase();
                     // Only keep if name contains "hand" or "shake"
                     return name.includes('hand') || name.includes('shake');
                 });
             };

             // Process root layers
             if (data.layers) {
                 data.layers = keepOnlyHands(data.layers);
             }

             // Process all precomps/assets
             if (Array.isArray(data.assets)) {
                 data.assets.forEach(asset => {
                     if (asset.layers) {
                         asset.layers = keepOnlyHands(asset.layers);
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

  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
  if (!animationData) {
    return <div className={`animate-pulse opacity-0 ${sizeClass} ${className}`} />;
  }
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`} style={{ background: 'transparent' }}>
      <Lottie 
        animationData={animationData} 
        loop={true} 
        className="w-full h-full"
        style={{ background: 'transparent' }}
        rendererSettings={{ 
          preserveAspectRatio: 'xMidYMid meet',
          clearCanvas: true,
          progressiveLoad: false,
          hideOnTransparent: true
        }}
      />
    </div>
  );
}