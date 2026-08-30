import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type BusinessProfile = {
  id: string;
  user_id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
};

export const LOGO_BUCKET = "logos";

export async function signedLogoUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

export function useBusiness() {
  return useQuery({
    queryKey: ["business"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_profiles")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      const profile = (data as BusinessProfile | null) ?? null;
      const logo = await signedLogoUrl(profile?.logo_url ?? null);
      return { profile, logo };
    },
  });
}
