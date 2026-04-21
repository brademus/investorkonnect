import React from "react";
import LoadingAnimation from "@/components/LoadingAnimation";

/**
 * Shared onboarding layout shell - header, step dots, card wrapper.
 */
export default function OnboardingShell({ step, totalSteps, saving, onBack, onNext, nextDisabled, nextLabel, children }) {
  return (
    <div className="h-screen md:min-h-screen bg-black overflow-hidden md:overflow-visible flex flex-col md:block" style={{ fontFamily: "'Cormorant Garamond', 'Playfair Display', Georgia, serif" }}>
      <header className="h-12 md:h-20 flex items-center justify-center border-b border-[#1F1F1F] flex-shrink-0">
        <div className="flex items-center gap-2">
          <img
            src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/690691338bcf93e1da3d088b/2fa135de5_IMG_0319.jpeg"
            alt="Investor Konnect"
            className="h-8 w-8 md:h-10 md:w-10 object-contain"
          />
          <span className="text-base md:text-xl font-bold text-[#E3C567]">INVESTOR KONNECT</span>
        </div>
      </header>

      <div className="py-2 md:py-6 flex flex-col items-center flex-shrink-0">
        <div className="flex items-center gap-2 md:gap-3 mb-1 md:mb-2">
          {Array.from({ length: totalSteps }).map((_, idx) => (
            <div
              key={idx}
              className={`rounded-full transition-all ${
                idx + 1 === step
                  ? 'w-3 h-3 md:w-4 md:h-4 bg-[#E3C567] animate-pulse'
                  : idx + 1 < step
                    ? 'w-2 h-2 md:w-3 md:h-3 bg-[#E3C567]'
                    : 'w-2 h-2 md:w-3 md:h-3 border-2 border-[#1F1F1F] bg-transparent'
              }`}
            />
          ))}
        </div>
        <p className="text-xs md:text-[14px] text-[#808080]">Step {step} of {totalSteps}</p>
      </div>

      <div className="max-w-[700px] mx-auto px-3 md:px-4 pb-28 md:pb-12 flex-1 md:flex-none min-h-0 md:min-h-0 flex flex-col md:block w-full">
        <div className="bg-[#0D0D0D] rounded-2xl md:rounded-3xl p-3 md:p-12 border border-[#1F1F1F] flex-1 md:flex-none min-h-0 flex flex-col md:block overflow-hidden md:overflow-visible" style={{ boxShadow: '0 6px 30px rgba(0,0,0,0.6)' }}>
          <div className="flex-1 min-h-0 overflow-y-auto md:overflow-visible flex flex-col md:block">
          {children}

          {/* Desktop: inline footer */}
          <div className="hidden md:flex items-center justify-between mt-8 pt-6 border-t border-[#1F1F1F]">
            {step > 1 ? (
              <button onClick={onBack} disabled={saving} className="text-[#808080] hover:text-[#E3C567] font-medium transition-colors">
                ← Back
              </button>
            ) : <div />}
            <button
              onClick={onNext}
              disabled={saving || nextDisabled}
              className="h-12 px-8 rounded-lg bg-[#E3C567] hover:bg-[#EDD89F] text-black font-bold transition-all duration-200 disabled:bg-[#1F1F1F] disabled:text-[#666666]"
            >
              {saving ? (
                <><LoadingAnimation className="w-4 h-4 mr-2 inline" />Saving...</>
              ) : (
                nextLabel || 'Continue →'
              )}
            </button>
          </div>
        </div>
        </div>
      </div>

      {/* Mobile: sticky footer with large buttons */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#0D0D0D] border-t border-[#1F1F1F] px-3 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]">
        <div className="flex items-center gap-2 max-w-[700px] mx-auto">
          {step > 1 ? (
            <button
              onClick={onBack}
              disabled={saving}
              className="h-12 px-5 rounded-lg bg-[#1A1A1A] border border-[#1F1F1F] text-[#FAFAFA] font-medium active:bg-[#2A2A2A] flex-shrink-0"
            >
              ← Back
            </button>
          ) : null}
          <button
            onClick={onNext}
            disabled={saving || nextDisabled}
            className="flex-1 h-12 px-5 rounded-lg bg-[#E3C567] active:bg-[#D4AF37] text-black font-bold transition-colors disabled:bg-[#1F1F1F] disabled:text-[#666666]"
          >
            {saving ? (
              <><LoadingAnimation className="w-4 h-4 mr-2 inline" />Saving...</>
            ) : (
              nextLabel || 'Continue →'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}