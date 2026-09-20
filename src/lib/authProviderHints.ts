import { supabase } from "@/integrations/supabase/client";

export type SignInMethod = "email" | "google";

const LAST_METHOD_KEY = "thrivein_last_signin_method";

export const getLastSignInMethod = (): SignInMethod | null => {
  try {
    const v = localStorage.getItem(LAST_METHOD_KEY);
    if (v === "email" || v === "google") return v;
  } catch {}
  return null;
};

export const setLastSignInMethod = (m: SignInMethod) => {
  try { localStorage.setItem(LAST_METHOD_KEY, m); } catch {}
};

export interface ProviderLookup {
  exists: boolean;
  providers: string[]; // 'email' | 'google' | 'apple' | ...
  masked_email: string | null;
}

const cache = new Map<string, { at: number; data: ProviderLookup }>();

/** Returns which providers an email is registered with. Cached 60s per email. */
export const lookupAuthProviders = async (email: string): Promise<ProviderLookup | null> => {
  const e = email.trim().toLowerCase();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return null;
  const hit = cache.get(e);
  if (hit && Date.now() - hit.at < 60_000) return hit.data;
  try {
    const { data, error } = await supabase.functions.invoke("lookup-auth-providers", {
      body: { email: e },
    });
    if (error || !data) return null;
    const out = data as ProviderLookup;
    cache.set(e, { at: Date.now(), data: out });
    return out;
  } catch {
    return null;
  }
};

/** Friendly label for a provider key. */
export const providerLabel = (p: string) =>
  p === "google" ? "Google"
  : p === "apple" ? "Apple"
  : p === "email" ? "Email + Password"
  : p.charAt(0).toUpperCase() + p.slice(1);
