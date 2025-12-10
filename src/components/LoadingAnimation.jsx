import React from 'react';
import Lottie from 'lottie-react';
import { Loader2 } from 'lucide-react';
// import animationData from './loading-animation.json'; 

export default function LoadingAnimation({ className = "w-24 h-24" }) {
  // Temporary: animationData is null until user provides the JSON
  const animationData = null;

  // Check if animationData is valid (has layers or minimal lottie structure)
  const isValid = animationData && Object.keys(animationData).length > 0;

  if (!isValid) {
    // Fallback if no JSON provided yet
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <Loader2 className="w-full h-full text-[#D3A029] animate-spin" />
        <p className="text-xs text-[#808080] mt-2 text-center sr-only">Loading...</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Lottie animationData={animationData} loop={true} />
    </div>
  );
}