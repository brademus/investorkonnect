import React from "react";
import { Star } from "lucide-react";

export default function ReviewPolicy() {
  return (
    <div className="min-h-screen bg-slate-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl p-8 md:p-12 border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <Star className="w-8 h-8 text-yellow-600" />
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900">Review Policy</h1>
          </div>

          <p className="text-lg text-slate-600 mb-8">
            Our review verification system prevents manipulation and ensures authenticity.
          </p>

          <div className="prose prose-slate max-w-none">
            <h2>Who Can Leave Reviews</h2>
            <p>Reviews can only be submitted by users who meet ALL criteria:</p>
            <ul>
              <li>Active investor account in good standing</li>
              <li>Signed platform NDA</li>
              <li>Completed transaction with the agent being reviewed</li>
              <li>Deal room was active for minimum 7 days</li>
              <li>Transaction verified by platform</li>
            </ul>

            <h2>Review Guidelines</h2>
            <p>Reviews must:</p>
            <ul>
              <li>Be based on personal experience</li>
              <li>Be truthful and accurate</li>
              <li>Focus on agent performance and professionalism</li>
              <li>Avoid profanity, threats, or personal attacks</li>
              <li>Not violate confidentiality or NDAs</li>
            </ul>

            <h2>Prohibited Content</h2>
            <p>Reviews containing the following will be rejected:</p>
            <ul>
              <li>Fake or fraudulent reviews</li>
              <li>Reviews written by friends, family, or competitors</li>
              <li>Threats, harassment, or hate speech</li>
              <li>Confidential deal information</li>
              <li>Spam or promotional content</li>
              <li>Unrelated complaints (e.g., platform issues)</li>
            </ul>

            <h2>Moderation Process</h2>
            <ol>
              <li><strong>Submission:</strong> Investor submits review</li>
              <li><strong>Verification:</strong> System verifies transaction and NDA status</li>
              <li><strong>Review:</strong> Team reviews for policy compliance</li>
              <li><strong>Publication:</strong> Approved reviews go live within 24-48 hours</li>
            </ol>

            <h2>Flagging Reviews</h2>
            <p>Users can flag reviews for:</p>
            <ul>
              <li>Suspected fake review</li>
              <li>Policy violation</li>
              <li>Confidential information disclosure</li>
              <li>Harassment or threats</li>
            </ul>
            <p>Flagged reviews are investigated within 48 hours.</p>

            <h2>Agent Response</h2>
            <p>Agents may respond to reviews to:</p>
            <ul>
              <li>Provide context or clarification</li>
              <li>Address concerns raised</li>
              <li>Thank reviewers for positive feedback</li>
            </ul>
            <p>Responses must remain professional and cannot attack reviewers.</p>

            <h2>Consequences for Violations</h2>
            <p><strong>For fake reviews:</strong></p>
            <ul>
              <li>1st offense: Warning + review removal</li>
              <li>2nd offense: 30-day suspension</li>
              <li>3rd offense: Permanent ban</li>
            </ul>

            <p><strong>For review manipulation:</strong></p>
            <ul>
              <li>Immediate account termination</li>
              <li>Potential legal action</li>
              <li>Reporting to relevant licensing authorities (agents)</li>
            </ul>

            <h2>Review Editing & Deletion</h2>
            <p>Reviewers may edit reviews within 7 days of posting. After 7 days, contact support for changes. Reviews cannot be deleted except for policy violations.</p>

            <h2>Questions?</h2>
            <p>Contact us at <a href="mailto:reviews@investorkonnect.com">reviews@investorkonnect.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}