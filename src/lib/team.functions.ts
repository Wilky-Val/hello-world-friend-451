import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const roleSchema = z.enum(["admin", "caisse", "comptabilite"]);

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("org_members")
    .select("owner_id, role")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || data.role !== "admin") throw new Error("Accès réservé à l'administrateur");
  return data.owner_id as string;
}

export type TeamMember = {
  id: string;
  user_id: string;
  role: "admin" | "caisse" | "comptabilite";
  display_name: string | null;
  email: string | null;
  created_at: string;
};

export const listTeam = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TeamMember[]> => {
    const ownerId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("org_members")
      .select("id, user_id, role, display_name, created_at")
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const rows = data ?? [];
    const withEmails = await Promise.all(
      rows.map(async (m: any) => {
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(m.user_id);
        return { ...m, email: u?.user?.email ?? null } as TeamMember;
      }),
    );
    return withEmails;
  });

export const createTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(72),
        role: roleSchema,
        displayName: z.string().max(80).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    const ownerId = await assertAdmin(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
    });
    if (createError || !created?.user) {
      throw new Error(createError?.message ?? "Création du compte impossible");
    }

    const { error: memberError } = await supabaseAdmin.from("org_members").insert({
      user_id: created.user.id,
      owner_id: ownerId,
      role: data.role,
      display_name: data.displayName?.trim() || null,
    });
    if (memberError) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(memberError.message);
    }

    return { ok: true, userId: created.user.id };
  });

export const deleteTeamMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ userId: z.string().uuid() }).parse(data))
  .handler(async ({ context, data }) => {
    const ownerId = await assertAdmin(context.supabase, context.userId);
    if (data.userId === context.userId) throw new Error("Impossible de supprimer votre propre compte");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: member, error } = await supabaseAdmin
      .from("org_members")
      .select("user_id, owner_id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!member || member.owner_id !== ownerId) throw new Error("Membre introuvable");

    await supabaseAdmin.from("org_members").delete().eq("user_id", data.userId);
    const { error: delError } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (delError) throw new Error(delError.message);
    return { ok: true };
  });
