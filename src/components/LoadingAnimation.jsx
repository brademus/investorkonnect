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
             // Remove background color
             delete data.bg;
             delete data.sc;
             
             // Deep clean to remove black/dark backgrounds
             const isBlackOrDark = (colorArray) => {
                 if (!Array.isArray(colorArray)) return false;
                 // Check if RGB values are all very low (dark/black)
                 return colorArray[0] <= 0.1 && colorArray[1] <= 0.1 && colorArray[2] <= 0.1;
             };
             
             const cleanLayers = (layers) => {
                 if (!Array.isArray(layers)) return layers;
                 
                 return layers.filter(layer => {
                     // Remove solid layers (backgrounds)
                     if (layer.ty === 1) {
                         // Check if it's a dark solid
                         if (layer.sc && isBlackOrDark(layer.sc)) return false;
                         return false; // Remove all solids to be safe
                     }
                     
                     // Check shape layers for black fills
                     if (layer.ty === 4 && layer.shapes) {
                         const layerStr = JSON.stringify(layer.shapes);
                         // Look for black color definitions
                         if (layerStr.includes('[0,0,0,1]') || layerStr.includes('[0,0,0]')) {
                             // Only remove if it's likely a background (large rectangle at bottom)
                             const isBackground = layer.ind === layers.length || 
                                                 (layer.nm && layer.nm.toLowerCase().includes('bg')) ||
                                                 (layer.nm && layer.nm.toLowerCase().includes('background'));
                             if (isBackground) return false;
                         }
                     }
                     
                     return true;
                 });
             };

             // Clean root layers
             if (data.layers) {
                 data.layers = cleanLayers(data.layers);
             }

             // Clean all precomp assets
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