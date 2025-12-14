import React, { useEffect, useRef } from 'react';
import lottie from 'lottie-web';

export default function LoadingAnimation({ className = "" }) {
  const containerRef = useRef(null);
  const animationRef = useRef(null);
  
  useEffect(() => {
    if (!containerRef.current) return;

    // Fetch and load the animation from the Gist
    fetch('https://gist.githubusercontent.com/brademus/8c625fc2ad75ad2e6012a5f5e8ca1e3a/raw/fca58ee4ce4afe709940a35504397a9c5e3c02ac/gistfile1.txt')
      .then(response => response.json())
      .then(animationData => {
        if (containerRef.current && !animationRef.current) {
          animationRef.current = lottie.loadAnimation({
            container: containerRef.current,
            renderer: 'svg',
            loop: true,
            autoplay: true,
            animationData: animationData,
            rendererSettings: {
              preserveAspectRatio: 'xMidYMid slice',
              clearCanvas: true,
              progressiveLoad: true,
              hideOnTransparent: true
            }
          });
        }
      })
      .catch(error => {
        console.error('Failed to load animation:', error);
      });

    return () => {
      if (animationRef.current) {
        animationRef.current.destroy();
        animationRef.current = null;
      }
    };
  }, []);

  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-16 h-16';
  
  return (
    <div 
      ref={containerRef} 
      className={`flex items-center justify-center ${sizeClass} ${className}`}
    />
  );
}