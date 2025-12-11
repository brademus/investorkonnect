import React from 'react';
import { motion } from 'framer-motion';

export default function LoadingAnimation({ className = "" }) {
  // Default size if not provided
  const sizeClass = className && (className.includes('w-') || className.includes('h-')) ? '' : 'w-64 h-64';
  
  return (
    <div className={`flex items-center justify-center ${sizeClass} ${className}`}>
      <motion.div
        className="relative"
        style={{ width: '100%', height: '100%' }}
        animate={{
          scale: [1, 1.1, 1],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      >
        {/* Simple handshake icon in yellow */}
        <svg
          viewBox="0 0 100 100"
          className="w-full h-full"
          style={{ filter: 'drop-shadow(0 4px 8px rgba(227, 197, 103, 0.3))' }}
        >
          {/* Left hand/arm */}
          <motion.path
            d="M20,50 L35,50 L40,45 L40,55 L35,50"
            fill="#E3C567"
            stroke="#D3A029"
            strokeWidth="2"
            animate={{
              d: [
                "M20,50 L35,50 L40,45 L40,55 L35,50",
                "M20,50 L35,48 L40,43 L40,53 L35,48",
                "M20,50 L35,50 L40,45 L40,55 L35,50"
              ]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/* Right hand/arm */}
          <motion.path
            d="M80,50 L65,50 L60,45 L60,55 L65,50"
            fill="#E3C567"
            stroke="#D3A029"
            strokeWidth="2"
            animate={{
              d: [
                "M80,50 L65,50 L60,45 L60,55 L65,50",
                "M80,50 L65,48 L60,43 L60,53 L65,48",
                "M80,50 L65,50 L60,45 L60,55 L65,50"
              ]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
          
          {/*握手的手指部分 */}
          <motion.circle
            cx="50"
            cy="50"
            r="8"
            fill="#E3C567"
            stroke="#D3A029"
            strokeWidth="2"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.9, 1, 0.9]
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          />
        </svg>
      </motion.div>
    </div>
  );
}