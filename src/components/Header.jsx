import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { 
  Home, Users, MessageSquare, FileText, CreditCard, 
  User, LogOut, Menu, X, ChevronDown
} from 'lucide-react';

export function Header({ profile }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  
  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const firstName = profile?.full_name?.split(' ')[0] || 'User';
  
  const handleLogout = async () => {
    try {
      await base44.auth.logout('/');
    } catch (err) {
      window.location.href = '/';
    }
  };
  
  const navLinks = [
    {
      label: 'Dashboard',
      icon: Home,
      href: createPageUrl(isInvestor ? "DashboardInvestor" : "Dashboard"),
      show: true
    },
    {
      label: 'Matches',
      icon: Users,
      href: createPageUrl("Matches"),
      show: isInvestor
    },
    /* Deal Rooms link removed */
    {
      label: 'Documents',
      icon: FileText,
      href: createPageUrl(isInvestor ? "InvestorDocuments" : "AgentDocuments"),
      show: true
    },
    {
      label: 'Subscription',
      icon: CreditCard,
      href: createPageUrl("Pricing"),
      show: true
    }
  ];

  return (
    <header className="bg-black/95 backdrop-blur-sm border-b border-[#1F1F1F] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Logo 
            size="default"
            showText={true}
            linkTo={createPageUrl("Dashboard")}
          />

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.filter(link => link.show).map((link) => {
              const Icon = link.icon;
              return (
                <Link 
                  key={link.label}
                  to={link.href} 
                  className="flex items-center gap-2 px-4 py-2 text-[#808080] hover:text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-2">
            {/* Desktop User Dropdown */}
            <div className="hidden md:block relative">
              <Button 
                variant="ghost" 
                size="sm" 
                className="flex items-center gap-2 hover:bg-[#0D0D0D]"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                  <span className="text-[#E3C567] font-semibold text-sm">
                    {firstName.charAt(0)}
                  </span>
                </div>
                <span className="text-[#FAFAFA] font-medium">{firstName}</span>
                <ChevronDown className="w-4 h-4 text-[#808080]" />
              </Button>

              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-[#0D0D0D] rounded-xl shadow-lg border border-[#1F1F1F] py-2 z-50">
                    <div className="px-4 py-3 border-b border-[#1F1F1F]">
                      <p className="text-sm font-semibold text-[#FAFAFA]">{profile?.full_name}</p>
                      <p className="text-xs text-[#808080] mt-1">{profile?.email}</p>
                      <span className="inline-block mt-2 px-2 py-1 bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium rounded-full border border-[#E3C567]/30">
                        {isInvestor ? 'Investor' : 'Agent'}
                      </span>
                    </div>
                    
                    <Link 
                      to={createPageUrl("AccountProfile")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm text-[#FAFAFA]">My Profile</span>
                    </Link>
                    
                    <Link 
                      to={createPageUrl("Pricing")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CreditCard className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm text-[#FAFAFA]">Subscription</span>
                    </Link>
                    
                    <div className="border-t border-[#1F1F1F] mt-2 pt-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 w-full hover:bg-[#DC2626]/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-[#DC2626]" />
                        <span className="text-sm text-[#DC2626] font-medium">Log Out</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button 
              variant="ghost" 
              size="sm" 
              className="lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="lg:hidden py-4 border-t border-[#1F1F1F] animate-in slide-in-from-top">
            {/* User Info */}
            <div className="px-3 py-3 mb-3 bg-[#0D0D0D] rounded-lg border border-[#1F1F1F]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#E3C567]/20 rounded-full flex items-center justify-center">
                  <span className="text-[#E3C567] font-semibold">
                    {firstName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#FAFAFA]">{profile?.full_name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#E3C567]/20 text-[#E3C567] text-xs font-medium rounded-full border border-[#E3C567]/30">
                    {isInvestor ? 'Investor' : 'Agent'}
                  </span>
                </div>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex flex-col gap-1 mb-3">
              {navLinks.filter(link => link.show).map((link) => {
                const Icon = link.icon;
                return (
                  <Link 
                    key={link.label}
                    to={link.href} 
                    className="flex items-center gap-3 px-3 py-3 text-[#808080] hover:text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profile & Logout */}
            <div className="border-t border-[#1F1F1F] pt-3 space-y-1">
              <Link 
                to={createPageUrl("AccountProfile")}
                className="flex items-center gap-3 px-3 py-3 text-[#808080] hover:text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                onClick={() => setMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">My Profile</span>
              </Link>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 w-full text-[#DC2626] hover:bg-[#DC2626]/10 rounded-lg transition-all"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log Out</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;