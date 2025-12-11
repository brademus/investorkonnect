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
             // Remove background color properties
             if (data.bg) delete data.bg;
             if (data.sc) delete data.sc;
             
             // Recursively remove solid layers and black backgrounds
             const cleanLayers = (layers) => {
                 if (!Array.isArray(layers)) return layers;
                 return layers.filter(layer => {
                     // Remove solid layers (type 1)
                     if (layer.ty === 1) return false;
                     
                     // Remove shape layers with black fills
                     if (layer.ty === 4 && layer.shapes) {
                         const hasBlackFill = JSON.stringify(layer.shapes).includes('"c":{"a":0,"k":[0,0,0,1]}');
                         if (hasBlackFill) return false;
                     }
                     
                     return true;
                 });
             };

             // Clean root layers
             if (data.layers) {
                 data.layers = cleanLayers(data.layers);
             }

             // Clean precomp layers
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

  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
  if (!animationData) {
    return <div className={`animate-pulse bg-transparent ${sizeClass} ${className}`} />;
  }
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`}>
      <Lottie 
        animationData={animationData} 
        loop={true} 
        className="w-full h-full"
        rendererSettings={{ 
          preserveAspectRatio: 'xMidYMid meet',
          clearCanvas: true
        }}
      />
    </div>
  );
}