import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOrgAccount, listOrgAccounts, setOrgActive } from "@/lib/platform.functions";
import { useState } from "react";

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
  const create = useServerFn(createOrgAccount);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [businessName, setBusinessName] = useState("");
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

  const createMutation = useMutation({
    mutationFn: () => create({ data: { email, password, businessName } }),
    onSuccess: () => {
      toast.success("Compte entreprise créé");
      setEmail("");
      setPassword("");
      setBusinessName("");
      qc.invalidateQueries({ queryKey: ["org-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erreur"),
  });

  return (
    <AppShell title="Super Admin" subtitle="Comptes entreprise (admin) de la plateforme">
      <form
        className="mb-6 grid gap-3 rounded-lg border border-border p-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          createMutation.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="bname">Nom de l'entreprise</Label>
          <Input id="bname" required maxLength={120} value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bemail">Email admin</Label>
          <Input id="bemail" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bpass">Mot de passe</Label>
          <Input id="bpass" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <div className="flex items-end">
          <Button type="submit" className="w-full" disabled={createMutation.isPending}>
            Créer le compte entreprise
          </Button>
        </div>
      </form>

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
