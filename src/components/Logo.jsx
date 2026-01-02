import React from 'react';
import { Link } from 'react-router-dom';

const LOGO_URL = 'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg';

export function Logo({ size = 'default', showText = true, linkTo = '/', className = '' }) {
  const sizes = {
    small: { img: 'w-8 h-8', text: 'text-base' },
    default: { img: 'w-10 h-10', text: 'text-lg' },
    large: { img: 'w-16 h-16', text: 'text-2xl' },
    xlarge: { img: 'w-24 h-24', text: 'text-4xl' }
  };

  const sizeClasses = sizes[size] || sizes.default;

  const LogoContent = () => (
    <div className={`flex items-center gap-2 ${className || ''}`}>
      {/* Logo Image */}
      <img 
        src={LOGO_URL}
        alt="Investor Konnect Logo" 
        className={`${sizeClasses.img} object-contain`}
      />
      
      {/* Company Name */}
      {showText && (
        <span className={`font-bold text-[#E3C567] ${sizeClasses.text} hidden sm:block`} style={{ fontFamily: "'Cormorant Garamond', serif" }}>
          Investor Konnect
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="hover:opacity-80 transition-opacity">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
}

export default Logo;