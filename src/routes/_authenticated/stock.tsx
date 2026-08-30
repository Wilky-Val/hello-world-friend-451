import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, type Product } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/stock")({
  head: () => ({
    meta: [
      { title: "Gestion de stock — MiniPOS" },
      {
        name: "description",
        content:
          "Ajoutez vos produits, suivez les quantités disponibles et fixez prix d'achat et prix de vente.",
      },
      { property: "og:title", content: "Gestion de stock — MiniPOS" },
      { property: "og:description", content: "Produits, quantités, prix d'achat et prix de vente." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StockPage,
});

type Draft = {
  id?: string;
  name: string;
  sku: string;
  stock_qty: string;
  cost_price: string;
  sale_price: string;
};

const EMPTY: Draft = { name: "", sku: "", stock_qty: "0", cost_price: "0", sale_price: "0" };

function StockPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [search, setSearch] = useState("");

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Product[];
    },
  });

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const payload = {
        name: d.name.trim(),
        sku: d.sku.trim() || null,
        stock_qty: Number(d.stock_qty) || 0,
        cost_price: Number(d.cost_price) || 0,
        sale_price: Number(d.sale_price) || 0,
      };
      if (d.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("products").insert({ ...payload, user_id: uid });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setDraft(EMPTY);
      toast.success("Produit enregistré");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Produit supprimé");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const filtered = products.filter((p) =>
    `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );
  const stockValue = products.reduce((s, p) => s + Number(p.stock_qty) * Number(p.cost_price), 0);

  return (
    <AppShell title="Gestion de stock" subtitle="Produits, quantités et prix">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Rechercher un produit..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <div className="flex-1" />
        <p className="text-sm text-muted-foreground">
          Valeur du stock : <span className="font-medium text-foreground">{formatMoney(stockValue)}</span>
        </p>
        <Button
          onClick={() => {
            setDraft(EMPTY);
            setOpen(true);
          }}
        >
          <Plus className="size-4" /> Nouveau produit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{products.length} produit(s)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Produit</th>
                <th className="px-4 py-2 font-medium">Réf.</th>
                <th className="px-4 py-2 text-right font-medium">Stock</th>
                <th className="px-4 py-2 text-right font-medium">Prix achat</th>
                <th className="px-4 py-2 text-right font-medium">Prix vente</th>
                <th className="px-4 py-2 text-right font-medium">Marge</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Chargement...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                    Aucun produit. Cliquez sur « Nouveau produit ».
                  </td>
                </tr>
              ) : (
                filtered.map((p) => (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium text-foreground">{p.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{p.sku ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      {Number(p.stock_qty) <= 5 ? (
                        <Badge variant="destructive">{Number(p.stock_qty)}</Badge>
                      ) : (
                        Number(p.stock_qty)
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{formatMoney(Number(p.cost_price))}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(Number(p.sale_price))}</td>
                    <td className="px-4 py-2 text-right text-primary">
                      {formatMoney(Number(p.sale_price) - Number(p.cost_price))}
                    </td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setDraft({
                            id: p.id,
                            name: p.name,
                            sku: p.sku ?? "",
                            stock_qty: String(p.stock_qty),
                            cost_price: String(p.cost_price),
                            sale_price: String(p.sale_price),
                          });
                          setOpen(true);
                        }}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft.id ? "Modifier le produit" : "Nouveau produit"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du produit</Label>
              <Input
                id="name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sku">Référence (optionnel)</Label>
              <Input
                id="sku"
                value={draft.sku}
                onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="qty">Quantité</Label>
                <Input
                  id="qty"
                  type="number"
                  value={draft.stock_qty}
                  onChange={(e) => setDraft({ ...draft, stock_qty: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cost">Prix achat</Label>
                <Input
                  id="cost"
                  type="number"
                  value={draft.cost_price}
                  onChange={(e) => setDraft({ ...draft, cost_price: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Prix vente</Label>
                <Input
                  id="price"
                  type="number"
                  value={draft.sale_price}
                  onChange={(e) => setDraft({ ...draft, sale_price: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button
              disabled={!draft.name.trim() || save.isPending}
              onClick={() => save.mutate(draft)}
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
