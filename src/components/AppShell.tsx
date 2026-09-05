import { Link, useNavigate } from "@tanstack/react-router";
import { Building2, FileText, LogOut, Package, Receipt, Shield, Users, Wallet } from "lucide-react";
import type { ReactNode } from "react";

import { RoleGate } from "@/components/RoleGate";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, canAccess, useAccountState, type AppRole } from "@/lib/roles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useIsPlatformAdmin } from "@/lib/platform";

const NAV = [
  { to: "/caisse", label: "Caisse", icon: Receipt },
  { to: "/stock", label: "Stock", icon: Package },
  { to: "/comptabilite", label: "Comptabilité", icon: Wallet },
  { to: "/rapport", label: "Rapport", icon: FileText },
  { to: "/entreprise", label: "Entreprise", icon: Building2 },
  { to: "/equipe", label: "Comptes", icon: Users },
] as const;

export function AppShell({
  title,
  subtitle,
  allow,
  children,
}: {
  title: string;
  subtitle?: string;
  allow?: AppRole[];
  children: ReactNode;
}) {
  const navigate = useNavigate();
  const { data: account, isPending } = useAccountState();
  const membership = account?.membership ?? null;
  const role = membership?.role;
  const { data: isPlatformAdmin } = useIsPlatformAdmin();
  const blocked = Boolean(!isPending && membership && !account?.active && !account?.isPlatformAdmin);

  const items = NAV.filter((item) => canAccess(role, item.to) || (role === "admin"));

  return (
    <div className="min-h-screen bg-background">
      <header className="no-print sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <Link to={role === "comptabilite" ? "/comptabilite" : "/caisse"} className="mr-2 font-semibold tracking-tight text-foreground">
            Mini<span className="text-primary">POS</span>
          </Link>
          <nav className="flex flex-1 flex-wrap gap-1">
            {(blocked ? [] : items).map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-primary/10 text-primary" }}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            ))}
            {isPlatformAdmin ? (
              <Link
                to="/super-admin"
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                activeProps={{ className: "bg-primary/10 text-primary" }}
              >
                <Shield className="size-4" />
                Super Admin
              </Link>
            ) : null}
          </nav>
          {role ? (
            <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              {ROLE_LABELS[role]}
            </span>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/auth" });
            }}
          >
            <LogOut className="size-4" />
            Quitter
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <div className="no-print mb-6">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
        {blocked ? (
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle>Compte désactivé</CardTitle>
              <CardDescription>
                Ce compte entreprise a été désactivé — contactez l'administrateur de la plateforme
                pour le réactiver.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/auth" });
                }}
              >
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        ) : allow ? (
          <RoleGate allow={allow}>{children}</RoleGate>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
