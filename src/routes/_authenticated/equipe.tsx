import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createTeamMember, deleteTeamMember, listTeam } from "@/lib/team.functions";
import { ROLE_LABELS, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/equipe")({
  head: () => ({
    meta: [
      { title: "Comptes & accès — MiniPOS" },
      {
        name: "description",
        content:
          "Créez des comptes caisse ou comptabilité et limitez l'accès de chaque employé dans MiniPOS.",
      },
      { property: "og:title", content: "Comptes & accès — MiniPOS" },
      { property: "og:description", content: "Gérez les comptes employés et leurs permissions." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
  return (
    <AppShell
      title="Comptes & accès"
      subtitle="Créez des comptes limités pour vos employés."
      allow={["admin"]}
    >
      <TeamContent />
    </AppShell>
  );
}

function TeamContent() {
  const queryClient = useQueryClient();
  const fetchTeam = useServerFn(listTeam);
  const addMember = useServerFn(createTeamMember);
  const removeMember = useServerFn(deleteTeamMember);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<AppRole>("caisse");

  const team = useQuery({ queryKey: ["team"], queryFn: () => fetchTeam() });

  const create = useMutation({
    mutationFn: () =>
      addMember({ data: { email: email.trim(), password, role, displayName: displayName.trim() } }),
    onSuccess: () => {
      toast.success("Compte créé");
      setEmail("");
      setPassword("");
      setDisplayName("");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: (userId: string) => removeMember({ data: { userId } }),
    onSuccess: () => {
      toast.success("Compte supprimé");
      queryClient.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Erreur"),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Nouveau compte</CardTitle>
          <CardDescription>
            Le compte caisse n'accède qu'à la vente. Le compte comptabilité n'accède qu'aux dépenses
            et au bénéfice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              create.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'employé</Label>
              <Input
                id="name"
                value={displayName}
                maxLength={80}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Marie Caissière"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="caisse@boutique.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="text"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6 caractères minimum"
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="caisse">{ROLE_LABELS.caisse}</SelectItem>
                  <SelectItem value="comptabilite">{ROLE_LABELS.comptabilite}</SelectItem>
                  <SelectItem value="admin">{ROLE_LABELS.admin}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={create.isPending}>
              Créer le compte
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Comptes de la boutique</CardTitle>
          <CardDescription>{team.data?.length ?? 0} compte(s)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {team.isPending ? <p className="text-sm text-muted-foreground">Chargement…</p> : null}
          {team.error ? (
            <p className="text-sm text-destructive">
              {team.error instanceof Error ? team.error.message : "Erreur de chargement"}
            </p>
          ) : null}
          {team.data?.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {m.display_name || m.email || m.user_id}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {m.email} · {ROLE_LABELS[m.role]}
                </p>
              </div>
              {m.role === "admin" ? (
                <span className="text-xs text-muted-foreground">Propriétaire</span>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove.mutate(m.user_id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
