import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Save, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { LOGO_BUCKET, useBusiness } from "@/lib/business";

export const Route = createFileRoute("/_authenticated/entreprise")({
  head: () => ({
    meta: [
      { title: "Mon entreprise — Nom, logo et coordonnées — MiniPOS" },
      {
        name: "description",
        content:
          "Enregistrez le nom de votre entreprise, son logo, son adresse et son numéro de téléphone pour les afficher sur vos tickets.",
      },
      { property: "og:title", content: "Mon entreprise — MiniPOS" },
      {
        property: "og:description",
        content: "Nom, logo, adresse et téléphone de votre entreprise sur chaque ticket.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BusinessPage,
});

function BusinessPage() {
  const qc = useQueryClient();
  const { data } = useBusiness();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!data?.profile) return;
    setName(data.profile.name ?? "");
    setAddress(data.profile.address ?? "");
    setPhone(data.profile.phone ?? "");
  }, [data?.profile]);

  const save = useMutation({
    mutationFn: async (logoPath?: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const payload = {
        user_id: uid,
        name: name.trim().slice(0, 120),
        address: address.trim().slice(0, 250) || null,
        phone: phone.trim().slice(0, 40) || null,
        ...(logoPath ? { logo_url: logoPath } : {}),
      };
      const { error } = await supabase
        .from("business_profiles")
        .upsert(payload, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business"] });
      toast.success("Informations enregistrées");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  async function onLogoChange(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choisissez une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop lourde (max 5 Mo)");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `${uid}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(LOGO_BUCKET)
        .upload(path, file, { upsert: true });
      if (error) throw error;
      await save.mutateAsync(path);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'envoi");
    } finally {
      setUploading(false);
    }
  }

  return (
    <AppShell title="Mon entreprise" subtitle="Ces informations apparaissent sur vos tickets">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom de l'entreprise</Label>
              <Input
                id="name"
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder="Boutique Valcin"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Adresse</Label>
              <Input
                id="address"
                value={address}
                maxLength={250}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="12, Rue Capois, Port-au-Prince"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <Input
                id="phone"
                value={phone}
                maxLength={40}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+509 0000 0000"
              />
            </div>
            <Button
              disabled={!name.trim() || save.isPending}
              onClick={() => save.mutate(undefined)}
            >
              <Save className="size-4" /> Enregistrer
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40">
              {data?.logo ? (
                <img
                  src={data.logo}
                  alt={`Logo de ${data.profile?.name || "l'entreprise"}`}
                  className="max-h-28 max-w-full object-contain"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Aucun logo</p>
              )}
            </div>
            <Label
              htmlFor="logo"
              className="flex cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <Upload className="size-4" />
              {uploading ? "Envoi..." : "Choisir un logo"}
            </Label>
            <input
              id="logo"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogoChange(e.target.files?.[0])}
            />
            <p className="text-xs text-muted-foreground">PNG ou JPG, 5 Mo maximum.</p>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
