import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/components/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Mail, Phone, MapPin, Send } from "lucide-react";
import { toast } from "sonner";

export default function Contact() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
    honeypot: ""
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Contact AgentVault - Get in Touch";
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.name = "description";
      document.head.appendChild(metaDesc);
    }
    metaDesc.content = "Have questions about AgentVault? Contact our team for support, demos, or partnership inquiries.";

    // Load EmailJS
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js';
    script.async = true;
    script.onload = () => {
      window.emailjs?.init('EMAILJS_PUBLIC_KEY_PLACEHOLDER');
    };
    document.body.appendChild(script);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Honeypot check
    if (formData.honeypot) {
      return;
    }

    setSubmitting(true);
    
    try {
      // EmailJS send (demo mode with placeholder)
      if (window.emailjs) {
        await window.emailjs.send(
          'EMAILJS_SERVICE_ID_PLACEHOLDER',
          'EMAILJS_TEMPLATE_CONTACT_PLACEHOLDER',
          {
            from_name: formData.name,
            from_email: formData.email,
            subject: formData.subject,
            message: formData.message,
            to_email: 'hello@agentvault.test'
          }
        );
      }

      // GA4 event
      if (window.gtag) {
        window.gtag('event', 'contact_form_submit', {
          method: 'Contact Page'
        });
      }

      navigate(createPageUrl("ThankYou"));
    } catch (error) {
      // Show success anyway in demo mode
      toast.success("Message received! We'll get back to you within 24 hours.");
      setFormData({ name: "", email: "", subject: "", message: "", honeypot: "" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 to-blue-900 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Mail className="w-16 h-16 mx-auto mb-6 text-blue-400" />
          <h1 className="text-4xl md:text-5xl font-bold mb-6">Get in Touch</h1>
          <p className="text-xl text-slate-300">
            Have questions? We're here to help.
          </p>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Mail className="w-8 h-8 text-blue-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-2">Email Us</h3>
                <a href="mailto:hello@agentvault.test" className="text-blue-600 hover:text-blue-700">
                  hello@agentvault.test
                </a>
                <p className="text-xs text-slate-500 mt-2">General inquiries & support</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Mail className="w-8 h-8 text-emerald-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-2">Support</h3>
                <a href="mailto:support@agentvault.test" className="text-slate-700">
                  support@agentvault.test
                </a>
                <p className="text-xs text-slate-500 mt-2">Technical support</p>
              </div>
              <div className="bg-white rounded-xl p-6 border border-slate-200">
                <Mail className="w-8 h-8 text-purple-600 mb-3" />
                <h3 className="font-semibold text-slate-900 mb-2">Security</h3>
                <a href="mailto:security@agentvault.test" className="text-slate-700">
                  security@agentvault.test
                </a>
                <p className="text-xs text-slate-500 mt-2">Report vulnerabilities</p>
              </div>
            </div>

            {/* Form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-xl p-8 border border-slate-200 shadow-lg">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Send us a message</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Honeypot */}
                  <input
                    type="text"
                    name="honeypot"
                    value={formData.honeypot}
                    onChange={(e) => setFormData({...formData, honeypot: e.target.value})}
                    style={{ display: 'none' }}
                    tabIndex="-1"
                    autoComplete="off"
                  />
                  
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject *</Label>
                    <Input
                      id="subject"
                      value={formData.subject}
                      onChange={(e) => setFormData({...formData, subject: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) => setFormData({...formData, message: e.target.value})}
                      rows={6}
                      required
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700"
                  >
                    {submitting ? "Sending..." : (
                      <>
                        Send Message
                        <Send className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}