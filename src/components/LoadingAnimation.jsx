import React from 'react';
import Lottie from 'lottie-react';
import animationData from './loading-animation-data.js';

export default function LoadingAnimation({ className = "" }) {

  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
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