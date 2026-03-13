import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { base44 } from "@/api/base44Client";
import { useCurrentProfile } from "@/components/useCurrentProfile";
import LoadingAnimation from "@/components/LoadingAnimation";
import { PlayCircle, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

const VIDEO_URL = "https://dl.dropboxusercontent.com/scl/fi/249oflc8vhiolye0x5vvr/dfghf.mov?rlkey=nk064ornkzn2qbwdrvaxthw3k&st=lys8lj3s";

export default function AgentVideo() {
  const navigate = useNavigate();
  const { profile, loading } = useCurrentProfile();
  const videoRef = useRef(null);
  const [videoEnded, setVideoEnded] = useState(false);
  const [videoStarted, setVideoStarted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Track the maximum time the user has legitimately reached (no skipping ahead)
  const maxReachedTimeRef = useRef(0);

  // Redirect if not qualified or already watched
  useEffect(() => {
    if (loading || !profile) return;

    const tier = profile.qualification_tier;
    const qualStatus = profile.qualification_status;

    // Not qualified yet — send back to questionnaire
    if (!qualStatus || qualStatus !== "completed" || tier === "rejected") {
      navigate(createPageUrl("AgentQualification"), { replace: true });
      return;
    }

    // Still conditional — send to review page
    if (tier === "conditional") {
      navigate(createPageUrl("ConditionalReview"), { replace: true });
      return;
    }

    // Already watched the video — go to onboarding
    if (profile.metadata?.agent_video_watched) {
      navigate(createPageUrl("AgentOnboarding"), { replace: true });
      return;
    }
  }, [loading, profile, navigate]);

  // Prevent fast-forwarding: if user seeks past maxReachedTime, snap back
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;
    const ct = video.currentTime;
    const dur = video.duration || 0;

    // Allow a small tolerance of 1.5 seconds for natural playback buffering
    if (ct > maxReachedTimeRef.current + 1.5) {
      video.currentTime = maxReachedTimeRef.current;
    } else {
      maxReachedTimeRef.current = Math.max(maxReachedTimeRef.current, ct);
    }

    setCurrentTime(video.currentTime);
    setDuration(dur);
  };

  const handleEnded = async () => {
    setVideoEnded(true);
    // Mark video as watched on the profile
    if (profile?.id) {
      await base44.entities.Profile.update(profile.id, {
        metadata: {
          ...(profile.metadata || {}),
          agent_video_watched: true,
          agent_video_watched_at: new Date().toISOString(),
        },
      });
      // Bust cache
      try { sessionStorage.removeItem("__ik_profile_cache"); } catch (_) {}
    }
  };

  const handleSeeking = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.currentTime > maxReachedTimeRef.current + 1.5) {
      video.currentTime = maxReachedTimeRef.current;
    }
  };

  const handleContinue = () => {
    navigate(createPageUrl("AgentOnboarding"), { replace: true });
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <LoadingAnimation className="w-64 h-64" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#E3C567] mb-3">
            Required: Platform Overview
          </h1>
          <p className="text-[#808080] text-base max-w-lg mx-auto">
            Please watch this video in full before continuing. You cannot skip ahead or fast-forward.
          </p>
        </div>

        {/* Video container */}
        <div className="relative rounded-2xl overflow-hidden border border-[#1F1F1F] bg-black shadow-2xl">
          <video
            ref={videoRef}
            src={VIDEO_URL}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleEnded}
            onSeeking={handleSeeking}
            onPlay={() => setVideoStarted(true)}
            onLoadedMetadata={() => {
              if (videoRef.current) setDuration(videoRef.current.duration);
            }}
            controls
            controlsList="nodownload noplaybackrate"
            disablePictureInPicture
            playsInline
            className="w-full aspect-video bg-black"
            style={{ outline: "none" }}
          />

          {/* Overlay when not started */}
          {!videoStarted && !videoEnded && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <PlayCircle className="w-16 h-16 text-[#E3C567] mx-auto mb-3 opacity-80" />
                <p className="text-[#FAFAFA] text-sm">Press play to begin</p>
              </div>
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 mb-6">
          <div className="flex items-center justify-between text-xs text-[#808080] mb-1.5">
            <span>Progress</span>
            <span>{Math.round(progressPct)}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-[#1F1F1F] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPct}%`,
                background: videoEnded
                  ? "#10B981"
                  : "linear-gradient(90deg, #E3C567 0%, #D3A029 100%)",
              }}
            />
          </div>
        </div>

        {/* Continue button */}
        <div className="text-center">
          {videoEnded ? (
            <Button
              onClick={handleContinue}
              className="bg-[#E3C567] hover:bg-[#EDD89F] text-black rounded-full font-semibold px-10 h-12 text-base"
            >
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Continue to Profile Setup
            </Button>
          ) : (
            <div className="flex items-center justify-center gap-2 text-[#808080] text-sm">
              <Lock className="w-4 h-4" />
              <span>Watch the full video to unlock the next step</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}