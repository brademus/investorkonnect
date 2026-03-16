import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from './utils';
import { base44 } from '@/api/base44Client';
import { Logo } from './Logo';
import { Button } from './ui/button';
import { 
  Home, Users, MessageSquare, FileText, CreditCard, 
  User, LogOut, Menu, X, ChevronDown, ShieldCheck, UserPlus
} from 'lucide-react';
import { toast } from 'sonner';


export function Header({ profile }) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Pending team invite state
  const [pendingInvite, setPendingInvite] = useState(null);
  const [inviteOwnerName, setInviteOwnerName] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);
  const [decliningInvite, setDecliningInvite] = useState(false);

  const isInvestor = profile?.user_role === 'investor';
  const isAgent = profile?.user_role === 'agent';
  const firstName = profile?.full_name?.split(' ')[0] || 'User';
  const isAdmin = profile?.role === 'admin' || profile?.user_role === 'admin';
  
  const handleLogout = async () => {
    try {
      await base44.auth.logout('/');
    } catch (err) {
      window.location.href = '/';
    }
  };

  // Check for pending team invite
  useEffect(() => {
    if (!profile?.email || profile?.team_owner_id) return;
    const checkInvite = async () => {
      try {
        const seats = await base44.entities.TeamSeat.filter({ 
          member_email: profile.email.toLowerCase(), 
          status: 'invited' 
        });
        if (seats.length > 0) {
          const seat = seats[0];
          setPendingInvite(seat);
          try {
            const owners = await base44.entities.Profile.filter({ id: seat.owner_profile_id });
            setInviteOwnerName(owners.length ? (owners[0].full_name || owners[0].email || seat.owner_email) : (seat.owner_email || 'a team owner'));
          } catch (_) {
            setInviteOwnerName(seat.owner_email || 'a team owner');
          }
        }
      } catch (_) {}
    };
    checkInvite();
  }, [profile?.email, profile?.team_owner_id]);

  const handleAcceptInvite = async () => {
    if (!pendingInvite) return;
    setAcceptingInvite(true);
    try {
      const res = await base44.functions.invoke('teamAcceptInvite', { seat_id: pendingInvite.id, action: 'accept' });
      if (res?.data?.ok) {
        toast.success("You've joined the team!");
        setPendingInvite(null);
        try { sessionStorage.removeItem('__ik_profile_cache'); } catch (_) {}
        window.location.reload();
      } else {
        toast.error(res?.data?.error || 'Failed to accept invite');
      }
    } catch (_) { toast.error('Failed to accept invite'); }
    setAcceptingInvite(false);
  };

  const handleDeclineInvite = async () => {
    if (!pendingInvite) return;
    setDecliningInvite(true);
    try {
      const res = await base44.functions.invoke('teamAcceptInvite', { seat_id: pendingInvite.id, action: 'decline' });
      if (res?.data?.ok) { toast.info('Invitation declined'); setPendingInvite(null); }
    } catch (_) { toast.error('Failed to decline invite'); }
    setDecliningInvite(false);
  };
  
  const navLinks = [];

  return (
    <header className="sticky top-0 z-50" style={{ background: 'linear-gradient(180deg, #17171B 0%, #111114 100%)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 8px 30px rgba(0,0,0,0.60)' }}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          
          {/* Left Spacer */}
          <div className="flex-1"></div>

          {/* Centered Logo */}
          <Logo 
            size="default"
            showText={true}
            linkTo={createPageUrl("Pipeline")}
          />

          {/* Right: Invite Banner + User Menu */}
          <div className="flex items-center gap-3 flex-1 justify-end">
            {/* Pending Team Invite — compact inline banner */}
            {pendingInvite && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#E3C567]/40 bg-[#E3C567]/10">
                <UserPlus className="w-3.5 h-3.5 text-[#E3C567] flex-shrink-0" />
                <span className="text-xs text-[#FAFAFA] whitespace-nowrap">
                  Join <span className="font-semibold text-[#E3C567]">{inviteOwnerName?.split(' ')[0] || 'team'}</span>'s team?
                </span>
                <button onClick={handleAcceptInvite} disabled={acceptingInvite} className="px-2.5 py-0.5 rounded-full bg-[#E3C567] text-black text-xs font-semibold hover:bg-[#EDD89F] transition-colors disabled:opacity-50">
                  {acceptingInvite ? '...' : 'Join'}
                </button>
                <button onClick={handleDeclineInvite} disabled={decliningInvite} className="px-2 py-0.5 rounded-full text-[#808080] text-xs hover:text-red-400 transition-colors disabled:opacity-50">
                  {decliningInvite ? '...' : 'Decline'}
                </button>
              </div>
            )}

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
                    
                    {isAdmin && (
                      <Link 
                        to={createPageUrl("Admin")}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <ShieldCheck className="w-4 h-4 text-[#E3C567]" />
                        <span className="text-sm text-[#E3C567] font-medium">Admin Panel</span>
                      </Link>
                    )}
                    
                    <Link 
                      to={createPageUrl("AccountProfile")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <User className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm text-[#FAFAFA]">My Profile</span>
                    </Link>
                    
                    {isInvestor && (
                      <Link 
                        to={createPageUrl("Pricing")}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        <CreditCard className="w-4 h-4 text-[#808080]" />
                        <span className="text-sm text-[#FAFAFA]">Subscription</span>
                      </Link>
                    )}
                    
                    <Link 
                      to={createPageUrl("TeamAccount")}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[#141414] transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Users className="w-4 h-4 text-[#808080]" />
                      <span className="text-sm text-[#FAFAFA]">Team Account</span>
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

        {/* Mobile: Pending invite banner */}
        {pendingInvite && (
          <div className="md:hidden py-2 border-t border-[#E3C567]/20">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 min-w-0">
                <UserPlus className="w-4 h-4 text-[#E3C567] flex-shrink-0" />
                <span className="text-xs text-[#FAFAFA] truncate">
                  Join <span className="font-semibold text-[#E3C567]">{inviteOwnerName?.split(' ')[0] || 'team'}</span>'s team?
                </span>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleAcceptInvite} disabled={acceptingInvite} className="px-3 py-1 rounded-full bg-[#E3C567] text-black text-xs font-semibold">
                  {acceptingInvite ? '...' : 'Join'}
                </button>
                <button onClick={handleDeclineInvite} disabled={decliningInvite} className="text-xs text-[#808080]">
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

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
              {isAdmin && (
                <Link 
                  to={createPageUrl("Admin")}
                  className="flex items-center gap-3 px-3 py-3 text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                  onClick={() => setMenuOpen(false)}
                >
                  <ShieldCheck className="w-5 h-5" />
                  <span className="font-medium">Admin Panel</span>
                </Link>
              )}
              
              <Link 
                to={createPageUrl("AccountProfile")}
                className="flex items-center gap-3 px-3 py-3 text-[#808080] hover:text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                onClick={() => setMenuOpen(false)}
              >
                <User className="w-5 h-5" />
                <span className="font-medium">My Profile</span>
              </Link>

              <Link 
                to={createPageUrl("TeamAccount")}
                className="flex items-center gap-3 px-3 py-3 text-[#808080] hover:text-[#E3C567] hover:bg-[#0D0D0D] rounded-lg transition-all"
                onClick={() => setMenuOpen(false)}
              >
                <Users className="w-5 h-5" />
                <span className="font-medium">Team Account</span>
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