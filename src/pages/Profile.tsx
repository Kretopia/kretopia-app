import { useState, useRef, useEffect } from "react";
import { PageTip } from "@/components/PageTip";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useSearchParams } from "react-router-dom";
import jsPDF from 'jspdf';
import { SkeletonProfile } from "@/components/ui/skeleton-card";
import { PageTransition } from "@/components/PageTransition";

// Context & Hooks
import { ProfileProvider, useProfileContext } from "@/contexts/ProfileContext";
import { useProfileData } from "@/hooks/useProfileData";
import { useAvatarUpload } from "@/hooks/useAvatarUpload";

// Components
import { PassportHero } from "@/components/passport/PassportHero";
import { FeaturePageHeader } from "@/components/features/FeaturePageHeader";
import { PASSPORT_TUTORIAL } from "@/components/landing/kretopia/tutorialContent";
import { CompanyProfileView } from "@/components/profile/CompanyProfileView";
import { CompanyProfileEditDialog } from "@/components/profile/CompanyProfileEditDialog";
import { ShareProfileDialog } from "@/components/profile/ShareProfileDialog";
import { ProfileDashboardDrawer } from "@/components/profile/ProfileDashboardDrawer";


// Refactored sections
import { ProfileDialogs } from "@/pages/profile/ProfileDialogs";
import { PassportCreditsCta } from "@/components/passport/PassportCreditsCta";
import { InviteCircleCard } from "@/components/InviteCircleCard";
import { ClaimContinueBanner } from "@/components/profile/ClaimContinueBanner";
import { ScoutDiscoveryBanner } from "@/components/profile/ScoutDiscoveryBanner";
import { DiscoveriesInbox } from "@/components/profile/DiscoveriesInbox";
import { ClaimedProfileGlow } from "@/components/onboarding/claim-flow/ClaimedProfileGlow";
import { ProfileCompletionProgress } from "@/components/profile/ProfileCompletionProgress";
import { ProfileStrengthBar } from "@/components/profile/ProfileStrengthBar";
import { checkProfileCompletion } from "@/lib/profileCompletion";
import { PassportAnchorStrip } from "@/components/passport/PassportAnchorStrip";
import { PassportKretoEntry } from "@/components/passport/PassportKretoEntry";
import { EPKPdfEditor } from "@/components/epk/EPKPdfEditor";
import { PassportShareSheet } from "@/components/passport/PassportShareSheet";
import { KretoActionCenter } from "@/components/passport/KretoActionCenter";
import { TrustOpportunityCenter } from "@/components/passport/TrustOpportunityCenter";
import { KretoPassportBuilder } from "@/components/passport/KretoPassportBuilder";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { computeStanding } from "@/lib/passport/standing";
import { useTaggedCredits } from "@/hooks/useTaggedCredits";


import { TIER_LIMITS, SubscriptionTier } from "@/lib/subscriptionLimits";

const ProfileContent = () => {
  const navigate = useNavigate();
  const {
    profile,
    portfolioItems,
    reviews,
    companyReviews,
    partnerDiscounts,
    industryStats,
    credits,
    awards,
    pressLinks,
    userBadge,
    stats,
    currentUserId,
    isLoading,
  } = useProfileContext();

  useEffect(() => {
    window.scrollTo(0, 0);
    const trackView = async () => {
      const { analytics } = await import("@/lib/analytics");
      analytics.pageView("profile");
    };
    trackView();
  }, []);

  const userTier: SubscriptionTier = (profile?.subscription_tier as SubscriptionTier) || "free";
  const hasAdvancedProfile = TIER_LIMITS[userTier].hasAdvancedProfile;

  const { toast } = useToast();
  const { user } = useAuth();
  const { fetchData } = useProfileData();
  const { uploadAvatar, isUploading: isUploadingAvatar } = useAvatarUpload();
  const { count: taggedCount } = useTaggedCredits(profile?.user_id);


  const [isEditOpen, setIsEditOpen] = useState(false);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [builderCredits, setBuilderCredits] = useState<{ project_name: string; role: string; year?: number | null }[] | null>(null);
  const [justRevealed, setJustRevealed] = useState<{ bioDrafted: boolean } | null>(null);
  // Read once on mount: ClaimedProfileGlow also reads ?claimed=true and strips
  // it shortly after, but every component reading the un-stripped param on its
  // own first render still sees "true" regardless of strip order.
  const [searchParams] = useSearchParams();
  const [justClaimed] = useState(() => searchParams.get("claimed") === "true");
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false);
  const [isCreatorCardOpen, setIsCreatorCardOpen] = useState(false);
  const [isEPKEditorOpen, setIsEPKEditorOpen] = useState(false);
  const [showCropDialog, setShowCropDialog] = useState(false);
  const [tempImageUrl, setTempImageUrl] = useState("");

  const [editForm, setEditForm] = useState({
    full_name: "",
    role: "",
    bio: "",
    location: "",
    avatar_url: "",
    company_size: "",
    collab_intent: "seeking_collaborators",
    company_tagline: "",
    cover_image_url: "",
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Applies Kreto's drafted bio/skills only after the user explicitly
  // confirms them in KretoPassportBuilder — never auto-published.
  const applyBuilderResult = async ({ bio, skills }: { bio: string | null; skills: string[] }) => {
    if (!profile?.user_id) { setBuilderCredits(null); return; }
    const existingSkills: string[] = Array.isArray(profile.professional_skills)
      ? (profile.professional_skills as any[]).map((s) => (typeof s === "string" ? s : s?.skill)).filter(Boolean)
      : [];
    const mergedSkills = Array.from(new Set([...existingSkills, ...skills]));
    const update: Record<string, any> = {};
    if (bio) update.bio = bio;
    if (skills.length > 0) update.professional_skills = mergedSkills;
    if (Object.keys(update).length > 0) {
      const { error } = await supabase.from("profiles").update(update).eq("user_id", profile.user_id);
      if (error) {
        toast({ title: "Couldn't save Passport", description: error.message, variant: "destructive" });
      } else {
        fetchData();
        const { analytics } = await import("@/lib/analytics");
        analytics.passportRevealed(!!bio);
        setJustRevealed({ bioDrafted: !!bio });
      }
    }
    setBuilderCredits(null);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("share") === "true" && profile) {
      setIsCreatorCardOpen(true);
      window.history.replaceState({}, "", "/profile");
    }
  }, [profile]);

  const handleShare = async () => {
    const { analytics } = await import("@/lib/analytics");
    analytics.featureUsed("profile_shared");
    setIsShareDialogOpen(true);
  };
  
  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const imageUrl = URL.createObjectURL(file);
    setTempImageUrl(imageUrl);
    setShowCropDialog(true);
    event.target.value = "";
  };

  const handleCropComplete = async (croppedBlob: Blob) => {
    const file = new File([croppedBlob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
    await uploadAvatar(file, editForm, setEditForm, fetchData);
    setShowCropDialog(false);
    setTempImageUrl("");
  };

  const handleImportData = async (data: any) => {
    if (!user) return;
    
    const updates: any = {};
    if (data.full_name) updates.full_name = data.full_name;
    if (data.role) updates.role = data.role;
    if (data.bio) updates.bio = data.bio;
    if (data.location) updates.location = data.location;
    
    setEditForm(prev => ({ ...prev, ...updates }));

    let importedCount = 0;
    if (data.portfolio_items && data.portfolio_items.length > 0) {
      const portfolioInserts = data.portfolio_items
        .filter((item: any) => item.title && item.media_url)
        .map((item: any) => ({
          user_id: user.id,
          project_name: item.title,
          role: 'Creator',
          source: 'portfolio',
          description: item.description || null,
          primary_media_url: item.media_url,
          media_type: item.media_type || 'image',
          thumbnail_url: item.thumbnail_url || null,
          tags: item.tags || null,
          credit_category: 'imported',
        }));

      if (portfolioInserts.length > 0) {
        const { error: portfolioError, data: inserted } = await supabase
          .from('credits')
          .insert(portfolioInserts)
          .select('id');

        if (portfolioError) {
          console.error('Error importing portfolio items:', portfolioError);
        } else {
          importedCount = inserted?.length || 0;
        }
      }
    }

    if (data.skills && data.skills.length > 0) {
      const skillNames = data.skills.map((s: any) => typeof s === 'string' ? s : s.skill || s);
      const existingSkills = (profile?.professional_skills as any[]) || [];
      const existingNames = existingSkills.map((s: any) => typeof s === 'string' ? s : s.skill || s.name || '');
      const newSkills = skillNames.filter((s: string) => !existingNames.includes(s));
      
      if (newSkills.length > 0) {
        const mergedSkills = [
          ...existingSkills,
          ...newSkills.map((s: string) => ({ skill: s, level: 3, category: 'General' }))
        ];
        
        await supabase
          .from('profiles')
          .update({ professional_skills: mergedSkills as any })
          .eq('user_id', user.id);
      }
    }

    await fetchData();
    
    const parts = [];
    if (Object.keys(updates).length > 0) parts.push("profile info updated");
    if (importedCount > 0) parts.push(`${importedCount} portfolio items imported`);
    if (data.skills?.length > 0) parts.push(`${data.skills.length} skills added`);
    
    toast({
      title: "Import Complete",
      description: parts.length > 0 ? parts.join(", ") + ". Review and save profile when ready." : "No data to import.",
    });
  };

  const handleEditSave = async (directData?: Record<string, any>) => {
    if (!user) return;

    const formData = directData || editForm;
    const isCompany = profile?.account_type === 'company';
    
    let updateData = isCompany ? {
      company_name: formData.full_name,
      company_industry: formData.role,
      company_about: formData.bio,
      company_address: formData.location,
      company_size: formData.company_size,
      company_logo_url: formData.avatar_url || editForm.avatar_url,
      company_tagline: formData.company_tagline || null,
      cover_image_url: formData.cover_image_url || null,
      full_name: formData.full_name,
    } : {
      full_name: formData.full_name,
      role: formData.role,
      bio: formData.bio,
      location: formData.location,
      avatar_url: formData.avatar_url || editForm.avatar_url,
      collab_intent: formData.collab_intent,
    };

    if (isCompany && galleryFiles.length > 0) {
      const existingImages = (profile?.company_images as string[]) || [];

      // Was a sequential for...of, each file awaited one at a time --
      // uploads are independent storage round trips, no reason not to run
      // them concurrently. Same continue-on-error behavior preserved: a
      // failed upload is dropped (null), never blocks the others.
      const uploadResults = await Promise.all(
        galleryFiles.map(async (file) => {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${user.id}-gallery-${Date.now()}-${Math.random()}.${fileExt}`;
            const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file);
            if (uploadError) return null;
            const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(fileName);
            return publicUrl;
          } catch (err) {
            console.error('Error uploading gallery image:', err);
            return null;
          }
        })
      );
      const newImageUrls = uploadResults.filter((url): url is string => url !== null);

      updateData = { ...updateData, company_images: [...existingImages, ...newImageUrls] as any } as any;
    }

    const { error } = await supabase.from('profiles').update(updateData).eq('user_id', user.id);

    if (error) {
      toast({ title: "Error", description: "Failed to update profile", variant: "destructive" });
      return;
    }

    await fetchData();
    setIsEditOpen(false);
    // Bump profile_update streak (fire-and-forget)
    supabase.rpc('bump_streak', { _streak_type: 'profile_update' }).then(() => {}, () => {});
    setGalleryFiles([]);
    setGalleryPreviews([]);
    
    const { analytics } = await import("@/lib/analytics");
    analytics.profileUpdate("profile_fields");
    
    toast({ title: "Success", description: "Profile updated successfully" });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pb-20 md:pb-6 bg-background">
        <div className="container mx-auto px-3 sm:px-4 max-w-3xl">
          <SkeletonProfile />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">Profile not found</p>
        </div>
      </div>
    );
  }

  // Company profile view
  if (profile.account_type === 'company') {
    return (
      <>
        <CompanyProfileView
          profile={profile}
          reviews={companyReviews}
          partnerDiscounts={partnerDiscounts}
          isOwnProfile={true}
          isPro={userTier === 'pro' || userTier === 'creator_pro' || userTier === 'founder'}
          onRefresh={fetchData}
          onEdit={() => {
            setEditForm({
              full_name: profile.company_name || profile.full_name || "",
              role: profile.company_industry || profile.role || "",
              bio: profile.company_about || profile.bio || "",
              location: profile.company_address || profile.location || "",
              avatar_url: profile.company_logo_url || profile.avatar_url || "",
              company_size: profile.company_size || "",
              collab_intent: "seeking_collaborators",
              company_tagline: profile.company_tagline || "",
              cover_image_url: profile.cover_image_url || "",
            });
            setIsEditOpen(true);
          }}
          onShare={handleShare}
        />
        <CompanyProfileEditDialog
          open={isEditOpen}
          onOpenChange={setIsEditOpen}
          editForm={editForm}
          onFormChange={setEditForm}
          onSave={handleEditSave}
          onAvatarUpload={handleAvatarUpload}
          isUploadingAvatar={isUploadingAvatar}
          galleryPreviews={galleryPreviews}
          onGalleryChange={(e) => {
            const files = Array.from(e.target.files || []);
            setGalleryFiles(prev => [...prev, ...files]);
            files.forEach(f => {
              const reader = new FileReader();
              reader.onload = (ev) => setGalleryPreviews(prev => [...prev, ev.target?.result as string]);
              reader.readAsDataURL(f);
            });
          }}
          onRemoveGalleryImage={(index) => {
            setGalleryPreviews(prev => prev.filter((_, i) => i !== index));
            setGalleryFiles(prev => prev.filter((_, i) => i !== index));
          }}
        />
        <ShareProfileDialog
          profile={{
            full_name: profile.company_name || profile.full_name || '',
            role: profile.company_industry || profile.role || '',
            bio: profile.company_about || profile.bio || '',
            user_id: profile.user_id,
            avatar_url: profile.company_logo_url || profile.avatar_url || '',
            location: profile.company_address || profile.location || '',
          }}
          portfolioItems={[]}
          open={isShareDialogOpen}
          onOpenChange={setIsShareDialogOpen}
        />
      </>
    );
  }

  return (
    <div className="accent-passport min-h-screen pb-24 sm:pb-20 md:pb-6 bg-background">
      <ClaimedProfileGlow />
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarUpload}
        className="hidden"
      />

      <FeaturePageHeader
        eyebrow="Passport"
        title="Passport."
        accentTitle="Your work, verified."
        subtitle="Your identity, your strongest credits, and every co-sign — one card you actually control."
        tutorial={{ featureKey: "passport", label: "How Passport works", steps: PASSPORT_TUTORIAL }}
      />

      <div className="container mx-auto px-3 sm:px-4 md:px-6 max-w-3xl">

        {/* Passport reveal — the reward moment right after Kreto builds the
            Passport. Uses the real Passport UI below it, doesn't replace it. */}
        {justRevealed && (
          <div className="mb-4 rounded-2xl border border-[hsl(var(--signal-teal))]/30 bg-gradient-to-br from-[hsl(var(--signal-teal))]/10 to-card p-5">
            <p className="text-lg font-semibold text-foreground">Your Creative Passport is ready.</p>
            {justRevealed.bioDrafted && (
              <p className="text-xs text-muted-foreground mt-1">
                Kreto drafted parts of this from your Creative Record — review it below.
              </p>
            )}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => setJustRevealed(null)}
                className="btn-glass btn-glass-primary text-xs font-semibold px-3 py-1.5 rounded-lg"
              >
                Looks good
              </button>
              <button
                type="button"
                onClick={() => { setIsEditOpen(true); setJustRevealed(null); }}
                className="btn-glass btn-glass-outline text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                Edit Passport
              </button>
              <button
                type="button"
                onClick={() => { navigate('/credits'); setJustRevealed(null); }}
                className="btn-glass btn-glass-outline text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                Review credit evidence
              </button>
              <button
                type="button"
                onClick={() => { setIsShareDialogOpen(true); setJustRevealed(null); }}
                className="btn-glass btn-glass-outline text-xs font-medium px-3 py-1.5 rounded-lg"
              >
                Share Passport
              </button>
            </div>
          </div>
        )}

        {/* Kreto entry point — Passport-native, not the generic whisper card */}
        <PassportKretoEntry className="mb-4" />

        {/* Post-claim "we found X credits" nudge — was built, never mounted.
            Also now the "Your Passport is ready" prompt for the magic-link
            return trip (?claimed=true), since sessionStorage's claimInfo
            doesn't survive the link being opened on another device/tab. */}
        <ClaimContinueBanner onRefresh={fetchData} justClaimed={justClaimed} />
        <ScoutDiscoveryBanner show={justClaimed} />

        {/* Discovered credit candidates — the real Phase 3 confirm screen.
            Was built but never mounted; this is the actual entry point. */}
        {profile?.user_id && (
          <DiscoveriesInbox
            userId={profile.user_id}
            onApproved={fetchData}
            onBulkConfirmed={setBuilderCredits}
          />
        )}

        {/* Identity section — who you are */}
        <section id="identity" className="scroll-mt-20">

        {/* The one dominant Passport surface — merges the old ProfileHero +
            PassportClaimHero pair into a single 3D HoloCard-wrapped hero. */}
        {profile && (() => {
          const verifiedCreditsList = credits?.filter((c: any) => c.verification_status === 'verified') || [];
          const verified = verifiedCreditsList.length;
          const ninetyDaysAgo = Date.now() - 90 * 86_400_000;
          const recent90 = verifiedCreditsList.filter((c: any) => {
            const t = c.created_at ? new Date(c.created_at).getTime() : 0;
            return t > ninetyDaysAgo;
          }).length;
          const completion = checkProfileCompletion(profile, portfolioItems?.length || 0).percentage;
          const cosigns = reviews?.filter((r: any) => r.status === 'approved').length || 0;
          const lastCreditAt = verifiedCreditsList
            .map((c: any) => c.created_at)
            .filter(Boolean)
            .sort()
            .pop() as string | undefined;
          const lastActivityAt = lastCreditAt || (profile as any).updated_at || null;
          const standing = computeStanding({
            verifiedCredits: verified,
            recentCredits90d: recent90,
            cosignsReceived: cosigns,
            profileCompletionPct: completion,
            activeProjects90d: stats?.projects || 0,
            lastActivityAt,
            verificationScore: (profile as any).verification_score ?? 0,
            unclaimed: !(profile as any).user_id,
          });
          return (
            <>
              <PassportHero
                profile={profile}
                standing={standing}
                credits={credits || []}
                verifiedCredits={verified}
                totalCredits={credits?.length || 0}
                cosigns={cosigns}
                taggedCount={taggedCount}
                onEdit={() => {
                  setEditForm({
                    full_name: profile.full_name || "",
                    role: profile.role || "",
                    bio: profile.bio || "",
                    location: profile.location || "",
                    avatar_url: profile.avatar_url || "",
                    company_size: profile.company_size || "",
                    collab_intent: (profile as any).collab_intent || "seeking_collaborators",
                    company_tagline: "",
                    cover_image_url: "",
                  });
                  setIsEditOpen(true);
                }}
                onShare={handleShare}
                onAvatarClick={() => fileInputRef.current?.click()}
                isUploadingAvatar={isUploadingAvatar}
                onShowQR={() => setIsQRDialogOpen(true)}
                onDownloadEPK={() => setIsEPKEditorOpen(true)}
              />
              {/* Block 1 of 2 — Kreto Action Center: everything "what should I do next" */}
              <div className="mt-3">
                <KretoActionCenter
                  credits={credits || []}
                  standing={standing}
                  onReviewCredits={() => navigate('/credits')}
                />
              </div>
            </>
          );
        })()}

        {/* Block 2 of 2 — Trust & Opportunity Center: recent momentum,
            collaborators, what Kreto remembers. Nothing after the Passport
            beyond these two blocks. */}
        {profile?.user_id && (
          <div className="mt-3">
            <TrustOpportunityCenter userId={profile.user_id} />
          </div>
        )}

        {/* The old "Preview public Passport" / "Private dashboard" exit
            buttons are gone -- Passport stays focused on identity,
            verification, stamps, QR and share (see FeaturePageHeader/
            PassportHero above); all of what "Private dashboard" used to
            show now lives in one unified dashboard on Today
            (TodayMetricsDashboard), reachable from the home screen. */}

        {/* Bridge to Credits — the full record (Stamps, Book Me, Skills,
            Co-signs, Reviews) now lives in the Credits dashboard. */}
        {profile && (
          <PassportCreditsCta
            verified={(credits || []).filter((c: any) => c.verification_status === 'verified').length}
            total={credits?.length || 0}
            cosigns={(reviews || []).filter((r: any) => r.status === 'approved').length}
          />
        )}

        </section>
        {/* /Identity */}
      </div>


      {/* Kreto builds the Passport — shown right after a batch credit confirm */}
      <Dialog open={!!builderCredits} onOpenChange={(open) => !open && setBuilderCredits(null)}>
        <DialogContent className="max-w-md">
          {builderCredits && (
            <KretoPassportBuilder
              role={profile?.role || undefined}
              existingBio={profile?.bio || undefined}
              confirmedCredits={builderCredits}
              onConfirm={applyBuilderResult}
              onCancel={() => setBuilderCredits(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* All Dialogs */}
      <ProfileDialogs
        profile={profile}
        portfolioItems={portfolioItems}
        isMessageDialogOpen={isMessageDialogOpen}
        setIsMessageDialogOpen={setIsMessageDialogOpen}
        isImportDialogOpen={isImportDialogOpen}
        setIsImportDialogOpen={setIsImportDialogOpen}
        isEditOpen={isEditOpen}
        setIsEditOpen={setIsEditOpen}
        isShareDialogOpen={isShareDialogOpen}
        setIsShareDialogOpen={setIsShareDialogOpen}
        isQRDialogOpen={isQRDialogOpen}
        setIsQRDialogOpen={setIsQRDialogOpen}
        isCreatorCardOpen={isCreatorCardOpen}
        setIsCreatorCardOpen={setIsCreatorCardOpen}
        showCropDialog={showCropDialog}
        setShowCropDialog={setShowCropDialog}
        tempImageUrl={tempImageUrl}
        setTempImageUrl={setTempImageUrl}
        onImportData={handleImportData}
        onCropComplete={handleCropComplete}
        isUploadingAvatar={isUploadingAvatar}
      />

      {/* EPK PDF Editor */}
      {profile && (
        <EPKPdfEditor
          open={isEPKEditorOpen}
          onClose={() => setIsEPKEditorOpen(false)}
          userId={profile.user_id}
          epkData={{
            profile: {
              full_name: profile.full_name,
              role: profile.role,
              job_title: profile.job_title,
              bio: profile.bio,
              location: profile.location,
              avatar_url: profile.avatar_url,
              website: profile.website,
              calendly_url: profile.calendly_url,
              linkedin_url: profile.linkedin_url,
              instagram_url: profile.instagram_url,
              twitter_url: profile.twitter_url,
              youtube_url: profile.youtube_url,
              spotify_url: profile.spotify_url,
              behance_url: profile.behance_url,
              imdb_url: profile.imdb_url,
              soundcloud_url: profile.soundcloud_url,
              average_rating: profile.average_rating,
              total_reviews: profile.total_reviews,
              professional_skills: profile.professional_skills,
              passion_skills: profile.passion_skills,
              collab_intent: profile.collab_intent,
              rate_range: profile.rate_range,
              cover_image_url: profile.cover_image_url,
              verification_tier: profile.verification_tier,
              verification_status: profile.verification_status,
            },
            credits: (credits || []).map((c: any) => ({
              id: c.id,
              project_name: c.project_name,
              role: c.role,
              year: c.year,
              platform: c.platform,
              isVerified: c.verification_status === 'verified',
            })),
            awards: (awards || []).map((a: any) => ({
              title: a.title,
              organization: a.organization,
              year: a.year,
            })),
            pressLinks: (pressLinks || []).map((p: any) => ({
              title: p.title,
              publication: p.publication,
              url: p.url,
            })),
            industryStats: (industryStats || []).map((s: any) => ({
              title: s.title,
              value: s.value,
              issuer: s.issuer,
            })),
            reviews: (reviews || []).map((r: any) => ({
              reviewer_name: r.reviewer_name || 'Verified Client',
              rating: r.rating,
              review_text: r.review_text,
            })),
          }}
        />
      )}
    </div>
  );
};

export default function Profile() {
  return (
    <PageTransition>
      <ProfileProvider>
        <ProfileContent />
      </ProfileProvider>
    </PageTransition>
  );
}
