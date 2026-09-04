import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { listOrgAccounts, setOrgActive } from "@/lib/platform.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
  head: () => ({
    meta: [
      { title: "Super Admin | MiniPOS" },
      { name: "description", content: "Gestion des comptes entreprise MiniPOS : activation et désactivation." },
      { property: "og:title", content: "Super Admin | MiniPOS" },
      { property: "og:description", content: "Gestion des comptes entreprise MiniPOS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function SuperAdminPage() {
  const list = useServerFn(listOrgAccounts);
  const toggle = useServerFn(setOrgActive);
  const qc = useQueryClient();

  const accounts = useQuery({ queryKey: ["org-accounts"], queryFn: () => list() });

  const mutation = useMutation({
    mutationFn: (vars: { ownerId: string; active: boolean }) => toggle({ data: vars }),
    onSuccess: () => {
      toast.success("Statut mis à jour");
      qc.invalidateQueries({ queryKey: ["org-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <AppShell title="Super Admin" subtitle="Comptes entreprise (admin) de la plateforme">
      {accounts.isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement…</p>
      ) : accounts.error ? (
        <p className="text-sm text-destructive">{(accounts.error as Error).message}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="px-3 py-2">Entreprise</th>
                <th className="px-3 py-2">Email admin</th>
                <th className="px-3 py-2">Comptes</th>
                <th className="px-3 py-2">Statut</th>
                <th className="px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {(accounts.data ?? []).map((a) => (
                <tr key={a.owner_id} className="border-t border-border">
                  <td className="px-3 py-2 font-medium">{a.business_name || "—"}</td>
                  <td className="px-3 py-2">{a.email ?? "—"}</td>
                  <td className="px-3 py-2">{a.members}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        a.active
                          ? "rounded-full bg-primary/10 px-2 py-1 text-xs text-primary"
                          : "rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive"
                      }
                    >
                      {a.active ? "Actif" : "Désactivé"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant={a.active ? "destructive" : "default"}
                      disabled={mutation.isPending}
                      onClick={() => mutation.mutate({ ownerId: a.owner_id, active: !a.active })}
                    >
                      {a.active ? "Désactiver" : "Activer"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
