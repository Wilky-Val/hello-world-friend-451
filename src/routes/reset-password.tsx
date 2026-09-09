import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Nouveau mot de passe — MiniPOS" },
      { name: "description", content: "Choisissez un nouveau mot de passe pour votre compte MiniPOS." },
      { property: "og:title", content: "Nouveau mot de passe — MiniPOS" },
      { property: "og:description", content: "Réinitialisation du mot de passe MiniPOS." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

type Status = "checking" | "ready" | "invalid";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    let done = false;

    async function establishSession() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));

      const errorDescription =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      if (errorDescription) {
        toast.error(errorDescription);
        setStatus("invalid");
        return;
      }

      // 1) PKCE style link: ?code=...
      const code = url.searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          window.history.replaceState({}, "", url.pathname);
          setStatus("ready");
          return;
        }
      }

      // 2) OTP style link: ?token_hash=...&type=recovery
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      if (tokenHash) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: (type as "recovery") ?? "recovery",
        });
        if (!error) {
          window.history.replaceState({}, "", url.pathname);
          setStatus("ready");
          return;
        }
      }

      // 3) Implicit style link: #access_token=...&refresh_token=...
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) {
          window.history.replaceState({}, "", url.pathname);
          setStatus("ready");
          return;
        }
      }

      // 4) Session already restored by the client (PASSWORD_RECOVERY event)
      const { data } = await supabase.auth.getSession();
      if (!done) setStatus(data.session ? "ready" : "invalid");
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
        done = true;
        setStatus("ready");
      }
    });

    void establishSession();
    return () => sub.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Mot de passe mis à jour.");
    navigate({ to: "/caisse" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>
            {status === "invalid"
              ? "Ce lien est expiré ou déjà utilisé."
              : "Choisissez un mot de passe d'au moins 6 caractères."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {status === "checking" ? (
            <p className="text-sm text-muted-foreground">Vérification du lien…</p>
          ) : status === "invalid" ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Demandez un nouvel email de réinitialisation depuis la page de connexion.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
                Retour à la connexion
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">Mot de passe</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                Enregistrer
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
