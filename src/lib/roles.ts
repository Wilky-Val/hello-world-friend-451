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
  const select = "id, user_id, owner_id, role, display_name";
  const { data, error } = await supabase
    .from("org_members")
    .select(select)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as Membership | null) ?? null;
}

export type AccountState = {
  membership: Membership | null;
  active: boolean;
  isPlatformAdmin: boolean;
};

export async function fetchAccountState(): Promise<AccountState> {
  const [{ data: adminFlag }, membership] = await Promise.all([
    supabase.rpc("is_platform_admin"),
    fetchMembership(),
  ]);
  const isPlatformAdmin = Boolean(adminFlag);
  if (!membership) return { membership: null, active: false, isPlatformAdmin };

  const { data: status } = await supabase
    .from("org_status")
    .select("active")
    .eq("owner_id", membership.owner_id)
    .maybeSingle();

  return { membership, active: status ? status.active : true, isPlatformAdmin };
}

export function useAccountState() {
  return useQuery({
    queryKey: ["account-state"],
    queryFn: fetchAccountState,
    staleTime: 30_000,
  });
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
  if (role === "caisse") return path === "/caisse" || path === "/rapport";
  if (role === "comptabilite") return path === "/comptabilite" || path === "/rapport";
  return false;
}
