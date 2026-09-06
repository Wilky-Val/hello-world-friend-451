import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type CashSession = {
  id: string;
  user_id: string;
  opening_amount: number;
  closing_amount: number | null;
  counted_amount: number | null;
  note: string | null;
  opened_at: string;
  closed_at: string | null;
  cashier_name: string | null;
};

export async function fetchCashierName(): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return "";
  const { data } = await supabase
    .from("org_members")
    .select("display_name")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  return data?.display_name?.trim() || auth.user.email || "";
}

export function useOpenSession() {
  return useQuery({
    queryKey: ["cash-session", "open"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("*")
        .is("closed_at", null)
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as CashSession | null) ?? null;
    },
  });
}

export function useSessionSales(sessionId: string | undefined) {
  return useQuery({
    queryKey: ["cash-session", "sales", sessionId],
    enabled: Boolean(sessionId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("total")
        .eq("session_id", sessionId!);
      if (error) throw error;
      const rows = (data ?? []) as { total: number }[];
      return {
        count: rows.length,
        total: rows.reduce((s, r) => s + Number(r.total), 0),
      };
    },
  });
}
