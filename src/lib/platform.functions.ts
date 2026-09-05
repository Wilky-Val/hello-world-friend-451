import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertPlatformAdmin(supabase: any) {
  const { data, error } = await supabase.rpc("is_platform_admin");
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Accès réservé au super administrateur");
}

export type OrgAccount = {
  owner_id: string;
  email: string | null;
  business_name: string | null;
  members: number;
  active: boolean;
  created_at: string;
};

export const listOrgAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OrgAccount[]> => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: members, error } = await supabaseAdmin
      .from("org_members")
      .select("owner_id, user_id, role, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const { data: statuses } = await supabaseAdmin.from("org_status").select("owner_id, active");
    const statusMap = new Map((statuses ?? []).map((s: any) => [s.owner_id, s.active]));

    const { data: profiles } = await supabaseAdmin
      .from("business_profiles")
      .select("owner_id, name");
    const nameMap = new Map((profiles ?? []).map((p: any) => [p.owner_id, p.name]));

    const byOwner = new Map<string, { count: number; created_at: string }>();
    for (const m of members ?? []) {
      const prev = byOwner.get(m.owner_id);
      byOwner.set(m.owner_id, {
        count: (prev?.count ?? 0) + 1,
        created_at: prev?.created_at ?? m.created_at,
      });
    }

    return Promise.all(
      [...byOwner.entries()].map(async ([ownerId, info]) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(ownerId);
        return {
          owner_id: ownerId,
          email: u?.user?.email ?? null,
          business_name: (nameMap.get(ownerId) as string | null) || null,
          members: info.count,
          active: statusMap.get(ownerId) !== false,
          created_at: info.created_at,
        } satisfies OrgAccount;
      }),
    );
  });

export const setOrgActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z.object({ ownerId: z.string().uuid(), active: z.boolean() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("org_status").upsert(
      {
        owner_id: data.ownerId,
        active: data.active,
        disabled_at: data.active ? null : new Date().toISOString(),
      },
      { onConflict: "owner_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createOrgAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().trim().email().max(255),
        password: z.string().min(6).max(72),
        businessName: z.string().trim().min(1).max(120),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await assertPlatformAdmin(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createErr) throw new Error(createErr.message);
    const userId = created.user?.id;
    if (!userId) throw new Error("Création du compte impossible");

    const { error: memberErr } = await supabaseAdmin.from("org_members").insert({
      user_id: userId,
      owner_id: userId,
      role: "admin",
      display_name: data.businessName,
    });
    if (memberErr) throw new Error(memberErr.message);

    const { error: statusErr } = await supabaseAdmin
      .from("org_status")
      .upsert({ owner_id: userId, active: true, disabled_at: null }, { onConflict: "owner_id" });
    if (statusErr) throw new Error(statusErr.message);

    const { error: profileErr } = await supabaseAdmin.from("business_profiles").insert({
      user_id: userId,
      owner_id: userId,
      name: data.businessName,
    });
    if (profileErr) throw new Error(profileErr.message);

    return { ok: true, ownerId: userId };
  });
