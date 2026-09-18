import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNetworkStats } from "@/hooks/useNetworkStats";
import { useReferralNetwork } from "@/hooks/useReferralNetwork";
import { getReferralsToNextTier } from "@/lib/referralEngine";
import { cn } from "@/lib/utils";
import { NetworkReachStats } from "./NetworkReachStats";
import { NetworkHealthScore } from "./NetworkHealthScore";
import { IndustryMap } from "./IndustryMap";
import { PathFinder } from "./PathFinder";
import { DegreeExplorerDrawer } from "./DegreeExplorerDrawer";
import { Users, Sparkles, UserPlus, Compass, Search, Gift, Trophy, Flame, Star, ArrowRight, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
interface ConnectionProfile {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  role: string | null;
}

const CreativeCircleCTA = ({ onInvite }: { onInvite: () => void }) => {
  const network = useReferralNetwork();
  const navigate = useNavigate();
  const nextTierInfo = getReferralsToNextTier(network.referralCount);

  const progressPercent = nextTierInfo
    ? Math.min(100, ((network.referralCount - network.tier.minReferrals) / (nextTierInfo.next.minReferrals - network.tier.minReferrals)) * 100)
    : 100;

  return (
    <Card className="p-4 mb-4 bg-gradient-to-br from-primary/5 via-accent/5 to-primary/10 border-primary/20">
      <div className="flex items-center gap-3 mb-2">
        <network.tier.icon className={cn("h-6 w-6", network.tier.color)} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-bold text-sm">Creative Circle</p>
            <Badge variant="secondary" className="text-[10px] px-1.5 h-4">{network.tier.label}</Badge>
          </div>
          {nextTierInfo ? (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {nextTierInfo.remaining} more to <nextTierInfo.next.icon className="h-3 w-3 inline" aria-hidden /> {nextTierInfo.next.label}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground">{network.tier.tagline}</p>
          )}
        </div>
        <Badge variant="outline" className="font-bold text-xs">{network.referralCount}</Badge>
      </div>

      {nextTierInfo && (
        <Progress value={progressPercent} className="h-1.5 mb-3" />
      )}

      <div className="flex gap-2">
        <Button onClick={onInvite} className="gap-1.5 flex-1" size="sm">
          <UserPlus className="h-3.5 w-3.5" />
          Invite
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/creative-circle")} className="gap-1.5">
          <ArrowRight className="h-3.5 w-3.5" />
          Rewards
        </Button>
      </div>
    </Card>
  );
};

interface NetworkVisualizationProps {
  onInvite: () => void;
}

export const NetworkVisualization = ({ onInvite }: NetworkVisualizationProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionProfile[]>([]);
  const [connectionCount, setConnectionCount] = useState(0);
  const [degreeDrawerOpen, setDegreeDrawerOpen] = useState(false);
  const [selectedDegree, setSelectedDegree] = useState<1 | 2 | 3>(1);
  const [showPathFinder, setShowPathFinder] = useState(false);
  
  // Use the network stats hook
  const { stats, loading: statsLoading } = useNetworkStats(user?.id);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [user?.id]);

  const fetchData = async () => {
    if (!user?.id) return;
    
    try {
      // Fetch user avatar
      const { data: profile } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .single();
      
      if (profile?.avatar_url) {
        setAvatarUrl(profile.avatar_url);
      }

      // Fetch direct connections
      const { data: outgoing } = await supabase
        .from('connections')
        .select('connected_user_id')
        .eq('user_id', user.id)
        .eq('status', 'accepted');
      
      const { data: incoming } = await supabase
        .from('connections')
        .select('user_id')
        .eq('connected_user_id', user.id)
        .eq('status', 'accepted');
      
      const connectionIds = new Set<string>();
      outgoing?.forEach(c => connectionIds.add(c.connected_user_id));
      incoming?.forEach(c => connectionIds.add(c.user_id));
      
      setConnectionCount(connectionIds.size);

      if (connectionIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url, role')
          .in('user_id', Array.from(connectionIds))
          .limit(6);
        
        setConnections(profiles || []);
      }
    } catch (err) {
      console.error('Error fetching network data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleProfileClick = (userId: string) => {
    navigate(`/profile/${userId}`);
  };

  const handleDegreeClick = (degree: 1 | 2 | 3) => {
    setSelectedDegree(degree);
    setDegreeDrawerOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-pulse">
          <div className="h-32 w-32 rounded-full bg-muted" />
        </div>
      </div>
    );
  }

  return (
    <div className="py-4 px-2">
      {/* Hero Section - 6 Degrees Branding */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 text-primary text-sm font-medium mb-3">
          <Compass className="h-4 w-4" />
          6 Degrees
        </div>
        <h2 className="text-xl font-bold mb-1">Your Creative Universe</h2>
        <p className="text-muted-foreground text-sm max-w-sm mx-auto">
          Every creator is connected. See how far your network reaches.
        </p>
      </div>

      {/* Interactive Visualization */}
      <div className="relative mx-auto mb-6" style={{ width: 240, height: 240 }}>
        {/* 3rd degree ring */}
        <button 
          onClick={() => stats.degree3 > 0 && handleDegreeClick(3)}
          className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground/20 flex items-center justify-center hover:border-muted-foreground/40 hover:bg-muted/5 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
          disabled={stats.degree3 === 0}
          style={{ width: 240, height: 240 }}
        >
          {stats.degree3 > 0 && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground bg-background px-1.5 rounded-full">
              3° • {stats.degree3.toLocaleString()}
            </span>
          )}
        </button>
        
        {/* 2nd degree ring */}
        <button 
          onClick={() => stats.degree2 > 0 && handleDegreeClick(2)}
          className="absolute rounded-full border-2 border-dashed border-accent/40 hover:border-accent hover:bg-accent/5 transition-colors cursor-pointer disabled:cursor-default disabled:hover:bg-transparent"
          disabled={stats.degree2 === 0}
          style={{ 
            width: 170, 
            height: 170,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          {stats.degree2 > 0 && (
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] text-accent-foreground bg-background px-1.5 rounded-full">
              2° • {stats.degree2.toLocaleString()}
            </span>
          )}
        </button>
        
        {/* 1st degree ring - active connections */}
        <button 
          onClick={() => handleDegreeClick(1)}
          className="absolute rounded-full border-2 border-primary/70 hover:border-primary hover:bg-primary/5 transition-colors cursor-pointer"
          style={{ 
            width: 105, 
            height: 105,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] text-primary bg-background px-1.5 rounded-full font-medium">
            1° • {stats.degree1}
          </span>
        </button>
        
        {/* Center - User Avatar */}
        <div 
          className="absolute bg-gradient-to-br from-primary to-accent rounded-full p-1 shadow-lg shadow-primary/30"
          style={{ 
            width: 60, 
            height: 60,
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)'
          }}
        >
          <Avatar className="h-14 w-14 border-2 border-background">
            <AvatarImage src={avatarUrl || undefined} />
            <AvatarFallback className="bg-background">
              <Sparkles className="h-5 w-5 text-primary" />
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Connection avatars on inner ring */}
        {connections.slice(0, 6).map((profile, i) => {
          const angle = i * (2 * Math.PI / Math.min(connections.length, 6)) - Math.PI / 2;
          const radius = 52;
          return (
            <button
              key={profile.user_id}
              onClick={() => handleProfileClick(profile.user_id)}
              className="absolute w-7 h-7 rounded-full overflow-hidden border-2 border-primary bg-background hover:scale-110 transition-transform cursor-pointer z-10"
              style={{
                top: `calc(50% + ${Math.sin(angle) * radius}px - 14px)`,
                left: `calc(50% + ${Math.cos(angle) * radius}px - 14px)`,
              }}
              title={profile.full_name || 'Creator'}
            >
              <Avatar className="h-full w-full">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-[9px]">
                  {profile.full_name?.charAt(0) || '?'}
                </AvatarFallback>
              </Avatar>
            </button>
          );
        })}
        
        {/* Placeholder dots for 2nd degree ring */}
        {stats.degree2 > 0 && [...Array(Math.min(8, stats.degree2))].map((_, i) => {
          const angle = i * (2 * Math.PI / 8) + 0.3;
          return (
            <div 
              key={`d2-${i}`}
              className="absolute w-2.5 h-2.5 rounded-full bg-accent/30 border border-accent/50"
              style={{
                top: `calc(50% + ${Math.sin(angle) * 85}px - 5px)`,
                left: `calc(50% + ${Math.cos(angle) * 85}px - 5px)`,
              }}
            />
          );
        })}

        {/* Placeholder dots for 3rd degree ring */}
        {stats.degree3 > 0 && [...Array(Math.min(12, stats.degree3))].map((_, i) => {
          const angle = i * (2 * Math.PI / 12) + 0.1;
          return (
            <div 
              key={`d3-${i}`}
              className="absolute w-2 h-2 rounded-full bg-muted-foreground/20 border border-muted-foreground/30"
              style={{
                top: `calc(50% + ${Math.sin(angle) * 118}px - 4px)`,
                left: `calc(50% + ${Math.cos(angle) * 118}px - 4px)`,
              }}
            />
          );
        })}
      </div>

      {/* Path Finder Toggle */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowPathFinder(!showPathFinder)}
        className="w-full mb-4 gap-2"
      >
        <Search className="h-4 w-4" />
        {showPathFinder ? "Hide Path Finder" : "Find Connection Path"}
      </Button>

      {/* Path Finder */}
      {showPathFinder && <PathFinder className="mb-4" />}

      {/* Network Reach Stats Card */}
      <NetworkReachStats 
        stats={stats} 
        loading={statsLoading} 
        className="mb-4"
        onDegreeClick={(degree) => {
          setSelectedDegree(degree as 1 | 2 | 3);
          setDegreeDrawerOpen(true);
        }}
      />

      {/* Network Health Score */}
      <NetworkHealthScore compact className="mb-4" />

      {/* Creative Circle CTA */}
      <CreativeCircleCTA onInvite={onInvite} />

      {/* Direct Connections + Quick Actions */}
      <Card className="p-3 mb-4 bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-full bg-primary/20">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">{connectionCount} Direct Connection{connectionCount !== 1 ? 's' : ''}</p>
              <p className="text-[11px] text-muted-foreground">Your inner creative circle</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/creative-circle")} className="gap-1 text-xs h-8">
            <ArrowRight className="h-3.5 w-3.5" />
            Circle
          </Button>
        </div>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/credits')} 
          className="gap-1.5 h-auto py-2.5 flex-col items-center"
        >
          <Trophy className="h-4 w-4 text-primary" />
          <span className="text-xs">Kretopia Credits</span>
          <span className="text-[10px] text-muted-foreground">Build your record</span>
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/opportunities')} 
          className="gap-1.5 h-auto py-2.5 flex-col items-center"
        >
          <Flame className="h-4 w-4 text-destructive" />
          <span className="text-xs">Find Gigs</span>
          <span className="text-[10px] text-muted-foreground">Get booked</span>
        </Button>
      </div>

      {/* Growth tip */}
      <p className="text-[11px] text-muted-foreground text-center">
        Every connection expands your reach exponentially
      </p>

      {/* Degree Explorer Drawer */}
      <DegreeExplorerDrawer
        open={degreeDrawerOpen}
        onOpenChange={setDegreeDrawerOpen}
        initialDegree={selectedDegree}
      />
    </div>
  );
};
