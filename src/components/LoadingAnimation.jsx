import React from 'react';
import Lottie from 'lottie-react';
import { Loader2 } from 'lucide-react';

export default function LoadingAnimation({ className = "w-24 h-24" }) {
  // To enable Lottie:
  // 1. Get the "Asset Link" (JSON URL) from LottieFiles
  // 2. Paste it below as the value for animationUrl
  const animationUrl = null; 
  
  const [animationData, setAnimationData] = React.useState(null);

  React.useEffect(() => {
    if (animationUrl) {
      fetch(animationUrl)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch");
          return res.json();
        })
        .then(data => setAnimationData(data))
        .catch(() => setAnimationData(null));
    }
  }, [animationUrl]);

  if (!animationData) {
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