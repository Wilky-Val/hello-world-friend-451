import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "caisse" | "comptabilite";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Administrateur",
  caisse: "Caisse (vente POS)",
  comptabilite: "Comptabilité",
};

export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/caisse",
  caisse: "/caisse",
  comptabilite: "/comptabilite",
};

export type Membership = {
  id: string;
  user_id: string;
  owner_id: string;
  role: AppRole;
  display_name: string | null;
};

export async function fetchMembership(): Promise<Membership | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("org_members")
    .select("id, user_id, owner_id, role, display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Membership | null) ?? null;
}

export function useMembership() {
  return useQuery({
    queryKey: ["membership"],
    queryFn: fetchMembership,
    staleTime: 60_000,
  });
}

export function canAccess(role: AppRole | undefined, path: string): boolean {
  if (!role) return false;
  if (role === "admin") return true;
  if (role === "caisse") return path === "/caisse";
  if (role === "comptabilite") return path === "/comptabilite";
  return false;
}
