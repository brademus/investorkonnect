import React from 'react';
import Lottie from 'lottie-react';
import { Loader2 } from 'lucide-react';
// import animationData from './loading-animation.json'; 

export default function LoadingAnimation({ className = "w-24 h-24" }) {
  // If you have the URL, paste it here:
  const animationUrl = "https://lottie.host/embed/ed6558a3-55e6-44f7-b219-839e2f1f9716/Lottie.json"; // Placeholder, waiting for user input
  
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