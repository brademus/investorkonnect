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
             // Simply remove background color properties
             if (data.bg) delete data.bg;
             if (data.sc) delete data.sc;
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