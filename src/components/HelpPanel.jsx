import React, { useState } from 'react';
import { X, Play, BookOpen, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function HelpPanel({ open, onOpenChange }) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = typeof open === 'boolean' ? open : internalOpen;
  const setIsOpen = onOpenChange || setInternalOpen;

  return (
    <>

      {/* Slide-out Panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-50 backdrop-blur-sm"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel */}
          <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-[#0D0D0D] border-l border-[#1F1F1F] z-50 shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-[#1F1F1F] flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#E3C567]">Help & Tutorials</h2>
                <p className="text-sm text-[#808080] mt-1">Learn how to use the platform</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-[#1F1F1F] transition-colors"
              >
                <X className="w-5 h-5 text-[#808080]" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-6">
                {/* Coming Soon Notice */}
                <div className="bg-[#60A5FA]/10 border border-[#60A5FA]/30 rounded-2xl p-6 text-center">
                  <Video className="w-12 h-12 text-[#60A5FA] mx-auto mb-3" />
                  <h3 className="text-lg font-bold text-[#FAFAFA] mb-2">
                    Video Tutorials Coming Soon
                  </h3>
                  <p className="text-sm text-[#808080]">
                    We're creating step-by-step video guides to help you master every feature
                  </p>
                </div>

                {/* Placeholder Tutorial Categories */}
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">Quick Start Guides</h4>
                  
                  {[
                    { title: 'Creating Your First Deal', duration: '3 min' },
                    { title: 'Finding the Right Agent', duration: '2 min' },
                    { title: 'Understanding the Deal Board', duration: '4 min' },
                    { title: 'Managing Documents & Files', duration: '3 min' },
                    { title: 'Communication Best Practices', duration: '5 min' }
                  ].map((tutorial, idx) => (
                    <div
                      key={idx}
                      className="bg-[#141414] border border-[#1F1F1F] rounded-xl p-4 hover:border-[#60A5FA]/30 transition-all cursor-not-allowed opacity-60"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-[#60A5FA]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Play className="w-5 h-5 text-[#60A5FA]" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-[#FAFAFA]">{tutorial.title}</p>
                          <p className="text-xs text-[#808080] mt-0.5">{tutorial.duration}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Support Section */}
                <div className="pt-6 border-t border-[#1F1F1F]">
                  <h4 className="text-sm font-semibold text-[#FAFAFA] mb-3">Need Help Now?</h4>
                  <div className="space-y-2">
                    <Button
                      onClick={() => window.open('mailto:support@investorkonnect.com', '_blank')}
                      className="w-full bg-[#1F1F1F] hover:bg-[#333] text-[#FAFAFA] justify-start"
                    >
                      <BookOpen className="w-4 h-4 mr-2" />
                      Email Support
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}