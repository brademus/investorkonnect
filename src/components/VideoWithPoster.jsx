import React, { useRef, useState } from "react";
import { Play } from "lucide-react";

const POSTER_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/6809238fa_IMG_0319.jpeg";

export default function VideoWithPoster({ src, className = "" }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef(null);

  const handlePlay = () => {
    setPlaying(true);
    setTimeout(() => {
      videoRef.current?.play();
    }, 100);
  };

  return (
    <div className={`relative w-full ${className}`}>
      {!playing ? (
        <button
          onClick={handlePlay}
          className="relative w-full aspect-video cursor-pointer group"
        >
          <img
            src={POSTER_URL}
            alt="Click to play video"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/20 transition-colors">
            <div className="w-20 h-20 rounded-full bg-[#E3C567] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
              <Play className="w-9 h-9 text-black ml-1" fill="black" />
            </div>
          </div>
        </button>
      ) : (
        <video
          ref={videoRef}
          src={src}
          className="w-full aspect-video"
          controls
          playsInline
          autoPlay
        />
      )}
    </div>
  );
}