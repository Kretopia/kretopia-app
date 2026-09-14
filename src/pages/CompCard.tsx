import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CompCardPreview } from "@/components/passport/model/CompCardPreview";
import { BrandLoader } from "@/components/brand/BrandDots";
import { Helmet } from "react-helmet-async";

/**
 * Public, chrome-free comp card view.
 * Route: /comp/:userId
 * Exactly what a model can DM/email a casting director.
 */
export default function CompCard() {
  const { userId } = useParams<{ userId: string }>();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<any | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId || authLoading) return;
    (async () => {
      // RLS on the base `profiles` table is owner-only as of migration
      // 20260502224404, so a non-owner opening a shared comp-card link
      // (anonymous visitor, or any other logged-in user) got nothing back
      // from this raw `.from('profiles')` read — the exact bug this fixes.
      // The owner still reads their own row directly (works today via RLS,
      // and is the only path that currently exposes comp_card_layout /
      // model_stats / mother_agency / model_unions / model_categories).
      // Everyone else goes through public_profiles_safe — the existing,
      // already-granted-to-anon safe path CreatorEPK already uses — but
      // that view doesn't (yet) expose those model-specific columns, so a
      // non-owner viewer falls back to headshot-only (avatar_url) with no
      // agency/stats/extra slots until a follow-up migration extends the
      // view (tracked alongside CreatorEPK's own documented field-gap in
      // PASSPORT_AND_CONVERSION_AUDIT.md). That's strictly better than
      // today's total "Comp card not found" for anyone but the owner.
      //
      // Also drops `portfolio_links` from the old select: it isn't a real
      // column on `profiles` (it lives on `applications`), so the fallback
      // below never actually got anything from it.
      const isOwner = !!user && user.id === userId;
      const { data: p } = isOwner
        ? await supabase
            .from("profiles")
            .select("user_id, full_name, avatar_url, mother_agency, model_unions, model_categories, model_stats, comp_card_layout, sub_roles")
            .eq("user_id", userId)
            .maybeSingle()
        : await supabase
            .from("public_profiles_safe")
            .select("user_id, full_name, avatar_url")
            .eq("user_id", userId)
            .maybeSingle();

      const layout: any = (p as any)?.comp_card_layout;
      const imgs: string[] = Array.from({ length: 5 }, () => "") as string[];
      if (layout?.slots && Array.isArray(layout.slots)) {
        layout.slots.forEach((s: any) => {
          if (typeof s?.slot_index === "number" && s.image_url && s.slot_index < 5) {
            imgs[s.slot_index] = s.image_url;
          }
        });
      }
      // Fill any empty slots with an avatar fallback
      const fallback = [(p as any)?.avatar_url].filter(Boolean) as string[];
      let fi = 0;
      for (let i = 0; i < 5; i++) {
        if (!imgs[i]) {
          while (fi < fallback.length && imgs.includes(fallback[fi])) fi++;
          if (fi < fallback.length) imgs[i] = fallback[fi++];
        }
      }
      setImages(imgs.filter(Boolean).slice(0, 5));
      setProfile(p);
      setLoading(false);
    })();
  }, [userId, user, authLoading]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-background"><BrandLoader /></div>;
  if (!profile) return <div className="min-h-screen grid place-items-center text-muted-foreground">Comp card not found</div>;

  const title = `${profile.full_name || "Model"} — Comp Card`;
  return (
    <div className="min-h-screen bg-background py-6 px-4">
      <Helmet>
        <title>{title}</title>
        <meta name="description" content={`Comp card for ${profile.full_name || "model"}`} />
      </Helmet>
      <div className="max-w-md mx-auto">
        <CompCardPreview
          name={profile.full_name || "Model"}
          agency={profile.mother_agency}
          unions={profile.model_unions}
          categories={profile.model_categories}
          stats={profile.model_stats}
          images={images}
          contact={null}
        />
        <div className="mt-3 text-center text-xs text-muted-foreground">
          Powered by Kretopia
        </div>
      </div>
    </div>
  );
}
