import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
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
    {
      label: 'Deal Rooms',
      icon: MessageSquare,
      href: createPageUrl("DealRooms"),
      show: true
    },
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
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo */}
          <Link 
            to={createPageUrl(isInvestor ? "DashboardInvestor" : "Dashboard")} 
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-10 h-10 bg-[#FEF3C7] rounded-lg flex items-center justify-center">
              <span className="text-[#D3A029] font-bold text-lg">IK</span>
            </div>
            <span className="font-bold text-[#111827] hidden sm:block text-lg">Investor Konnect</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.filter(link => link.show).map((link) => {
              const Icon = link.icon;
              return (
                <Link 
                  key={link.label}
                  to={link.href} 
                  className="flex items-center gap-2 px-4 py-2 text-[#6B7280] hover:text-[#D3A029] hover:bg-[#FFFBEB] rounded-lg transition-all"
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
                className="flex items-center gap-2 hover:bg-[#FFFBEB]"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="w-8 h-8 bg-[#FEF3C7] rounded-full flex items-center justify-center">
                  <span className="text-[#D3A029] font-semibold text-sm">
                    {firstName.charAt(0)}
                  </span>
                </div>
                <span className="text-[#111827] font-medium">{firstName}</span>
                <ChevronDown className="w-4 h-4 text-[#6B7280]" />
              </Button>

              {userMenuOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setUserMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="text-sm font-semibold text-[#111827]">{profile?.full_name}</p>
                      <p className="text-xs text-[#9CA3AF] mt-1">{profile?.email}</p>
                      <span className="inline-block mt-2 px-2 py-1 bg-[#FEF3C7] text-[#D3A029] text-xs font-medium rounded-full">
                        {isInvestor ? 'Investor' : 'Agent'}
                      </span>
                    </div>
                    
                    <Link 
                      to={createPageUrl("AccountProfile")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#FFFBEB] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-sm text-[#111827]">My Profile</span>
                    </Link>
                    
                    <Link 
                      to={createPageUrl("Pricing")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#FFFBEB] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <CreditCard className="w-4 h-4 text-[#6B7280]" />
                      <span className="text-sm text-[#111827]">Subscription</span>
                    </Link>
                    
                    <div className="border-t border-gray-100 mt-2 pt-2">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 w-full hover:bg-red-50 transition-colors"
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
          <div className="lg:hidden py-4 border-t border-gray-200 animate-in slide-in-from-top">
            {/* User Info */}
            <div className="px-3 py-3 mb-3 bg-[#FFFBEB] rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#FEF3C7] rounded-full flex items-center justify-center">
                  <span className="text-[#D3A029] font-semibold">
                    {firstName.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#111827]">{profile?.full_name}</p>
                  <span className="inline-block mt-1 px-2 py-0.5 bg-[#FEF3C7] text-[#D3A029] text-xs font-medium rounded-full">
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
                    className="flex items-center gap-3 px-3 py-3 text-[#6B7280] hover:text-[#D3A029] hover:bg-[#FFFBEB] rounded-lg transition-all"
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="font-medium">{link.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Profile & Logout */}
            <div className="border-t border-gray-200 pt-3 space-y-1">
              <Link 
                to={createPageUrl("AccountProfile")}
                className="flex items-center gap-3 px-3 py-3 text-[#6B7280] hover:text-[#D3A029] hover:bg-[#FFFBEB] rounded-lg transition-all"
                onClick={() => setMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">My Profile</span>
              </Link>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-3 w-full text-[#DC2626] hover:bg-red-50 rounded-lg transition-all"
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