import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_HOME, useMembership, type AppRole } from "@/lib/roles";

export function RoleGate({ allow, children }: { allow: AppRole[]; children: ReactNode }) {
  const { data: membership, isPending } = useMembership();

  if (isPending) {
    return <p className="text-sm text-muted-foreground">Chargement…</p>;
  }

  const role = membership?.role;
  if (role && allow.includes(role)) return <>{children}</>;

  return (
    <Card className="max-w-md">
      <CardHeader>
        <CardTitle>Accès refusé</CardTitle>
        <CardDescription>
          Votre compte {role ? `« ${role} »` : ""} n'a pas accès à cette section.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="outline">
          <Link to={role ? ROLE_HOME[role] : "/auth"}>Retour à mon espace</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
