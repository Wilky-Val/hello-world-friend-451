import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_HOME, fetchMembership } from "@/lib/roles";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — MiniPOS Caisse & Stock" },
      {
        name: "description",
        content:
          "Connectez-vous à MiniPOS pour gérer votre stock, vos dépenses et encaisser vos ventes.",
      },
      { property: "og:title", content: "Connexion — MiniPOS" },
      { property: "og:description", content: "Accédez à votre caisse, votre stock et votre comptabilité." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goHome = async () => {
    const membership = await fetchMembership();
    navigate({ to: membership ? ROLE_HOME[membership.role] : "/caisse" });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) void goHome();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Compte créé. Vous pouvez vous connecter.");
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await goHome();
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>
            Mini<span className="text-primary">POS</span>
          </CardTitle>
          <CardDescription>
            {mode === "login" ? "Connectez-vous à votre caisse." : "Créez votre compte boutique."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="boutique@exemple.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {mode === "login" ? "Se connecter" : "Créer le compte"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "Pas de compte ? S'inscrire" : "J'ai déjà un compte"}
          </button>
          <button
            type="button"
            className="mt-2 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
            disabled={loading}
            onClick={async () => {
              if (!email) {
                toast.error("Entrez d'abord votre email");
                return;
              }
              setLoading(true);
              const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`,
              });
              setLoading(false);
              if (error) toast.error(error.message);
              else toast.success("Email de réinitialisation envoyé. Vérifiez votre boîte mail.");
            }}
          >
            Mot de passe oublié ?
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
