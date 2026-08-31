import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, LockOpen, Minus, Plus, Printer, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
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
import { useBusiness } from "@/lib/business";
import { useOpenSession, useSessionSales } from "@/lib/cash-session";

import {
  cartCost,
  cartTotal,
  formatDate,
  formatMoney,
  type CartLine,
  type Product,
} from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/caisse")({
  head: () => ({
    meta: [
      { title: "Caisse — Encaisser et imprimer un ticket — MiniPOS" },
      {
        name: "description",
        content:
          "Encaissez rapidement vos ventes, calculez la monnaie à rendre et imprimez la fiche du client.",
      },
      { property: "og:title", content: "Caisse — MiniPOS" },
      {
        property: "og:description",
        content: "Vente rapide, calcul de la monnaie et ticket imprimable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CashierPage,
});

type Receipt = {
  ticket_no: number;
  created_at: string;
  customer: string;
  total: number;
  paid: number;
  change_due: number;
  lines: { name: string; qty: number; unit_price: number }[];
};

function CashierPage() {
  const qc = useQueryClient();
  const { data: business } = useBusiness();
  const [search, setSearch] = useState("");

  const [lines, setLines] = useState<CartLine[]>([]);
  const [paid, setPaid] = useState("");
  const [customer, setCustomer] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [openingAmount, setOpeningAmount] = useState("");
  const [countedAmount, setCountedAmount] = useState("");
  const [closeOpen, setCloseOpen] = useState(false);

  const { data: session, isLoading: sessionLoading } = useOpenSession();
  const { data: sessionSales } = useSessionSales(session?.id);

  const openSession = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const amount = Number(openingAmount);
      if (!Number.isFinite(amount) || amount < 0) throw new Error("Montant invalide");
      const { error } = await supabase
        .from("cash_sessions")
        .insert({ user_id: uid, opening_amount: amount });
      if (error) throw error;
    },
    onSuccess: () => {
      setOpeningAmount("");
      qc.invalidateQueries({ queryKey: ["cash-session"] });
      toast.success("Caisse ouverte");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const closeSession = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error("Aucune caisse ouverte");
      const counted = countedAmount === "" ? null : Number(countedAmount);
      if (counted !== null && !Number.isFinite(counted)) throw new Error("Montant invalide");
      const expected = Number(session.opening_amount) + (sessionSales?.total ?? 0);
      const { error } = await supabase
        .from("cash_sessions")
        .update({
          closed_at: new Date().toISOString(),
          closing_amount: expected,
          counted_amount: counted,
        })
        .eq("id", session.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setCountedAmount("");
      setCloseOpen(false);
      setLines([]);
      qc.invalidateQueries({ queryKey: ["cash-session"] });
      toast.success("Caisse fermée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });


  const { data: products = [] } = useQuery({
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

  const total = cartTotal(lines);
  const cost = cartCost(lines);
  const paidNum = Number(paid) || 0;
  const change = paidNum - total;

  function addLine(p: Product) {
    const stock = Number(p.stock_qty);
    if (stock < 1) {
      toast.error(`Stock VIDE — « ${p.name} » ne peut pas être vendu`);
      return;
    }
    setLines((prev) => {
      const found = prev.find((l) => l.product.id === p.id);
      if (found) {
        if (found.qty + 1 > stock) {
          toast.error(`Stock insuffisant : ${stock} en stock`);
          return prev;
        }
        return prev.map((l) => (l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { product: p, qty: 1 }];
    });
  }

  function setQty(id: string, qty: number) {
    setLines((prev) =>
      prev.flatMap((l) => {
        if (l.product.id !== id) return [l];
        if (qty <= 0) return [];
        const stock = Number(l.product.stock_qty);
        if (qty > stock) {
          toast.error(`Stock insuffisant : ${stock} en stock`);
          return [{ ...l, qty: stock }];
        }
        return [{ ...l, qty }];
      }),
    );
  }

  const checkout = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      if (lines.length === 0) throw new Error("Le panier est vide");
      if (!session) throw new Error("Ouvrez la caisse avant d'encaisser");
      const vide = lines.find((l) => Number(l.product.stock_qty) < 1);
      if (vide) throw new Error(`Stock VIDE : ${vide.product.name}`);


      const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
          user_id: uid,
          total,
          cost_total: cost,
          paid: paidNum,
          change_due: change > 0 ? change : 0,
          customer: customer.trim() || null,
          session_id: session.id,
        })
        .select("*")
        .single();
      if (saleError) throw saleError;

      const { error: itemsError } = await supabase.from("sale_items").insert(
        lines.map((l) => ({
          sale_id: sale.id,
          user_id: uid,
          product_id: l.product.id,
          product_name: l.product.name,
          qty: l.qty,
          unit_price: Number(l.product.sale_price),
          unit_cost: Number(l.product.cost_price),
        })),
      );
      if (itemsError) throw itemsError;

      for (const l of lines) {
        const { error } = await supabase
          .from("products")
          .update({ stock_qty: Number(l.product.stock_qty) - l.qty })
          .eq("id", l.product.id);
        if (error) throw error;
      }

      return {
        ticket_no: sale.ticket_no,
        created_at: sale.created_at,
        customer: customer.trim(),
        total,
        paid: paidNum,
        change_due: change > 0 ? change : 0,
        lines: lines.map((l) => ({
          name: l.product.name,
          qty: l.qty,
          unit_price: Number(l.product.sale_price),
        })),
      } satisfies Receipt;
    },
    onSuccess: (r) => {
      setReceipt(r);
      setLines([]);
      setPaid("");
      setCustomer("");
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales"] });
      qc.invalidateQueries({ queryKey: ["cash-session"] });
      toast.success(`Vente #${r.ticket_no} enregistrée`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const filtered = products.filter((p) =>
    `${p.name} ${p.sku ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  if (!sessionLoading && !session) {
    return (
      <AppShell title="Ouverture de caisse" subtitle="Indiquez le fond de caisse pour commencer">
        <Card className="mx-auto max-w-md">
          <CardHeader>
            <CardTitle className="text-base">Fond de caisse</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="opening">Montant d'ouverture</Label>
              <Input
                id="opening"
                type="number"
                min="0"
                placeholder="0.00"
                value={openingAmount}
                onChange={(e) => setOpeningAmount(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={openingAmount === "" || openSession.isPending}
              onClick={() => openSession.mutate()}
            >
              <LockOpen className="size-4" /> Ouvrir la caisse
            </Button>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const expectedCash = Number(session?.opening_amount ?? 0) + (sessionSales?.total ?? 0);

  return (
    <AppShell title="Caisse" subtitle="Sélectionnez les produits, encaissez et imprimez la fiche">
      {session ? (
        <Card className="no-print mb-6">
          <CardContent className="flex flex-wrap items-center gap-4 py-4 text-sm">
            <div>
              <p className="text-muted-foreground">Fond d'ouverture</p>
              <p className="font-medium text-foreground">
                {formatMoney(Number(session.opening_amount))}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Ventes ({sessionSales?.count ?? 0})</p>
              <p className="font-medium text-foreground">{formatMoney(sessionSales?.total ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Attendu en caisse</p>
              <p className="font-semibold text-primary">{formatMoney(expectedCash)}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              Ouverte le {formatDate(session.opened_at)}
            </div>
            <Button variant="outline" size="sm" onClick={() => setCloseOpen(true)}>
              <Lock className="size-4" /> Fermer la caisse
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="no-print">
          <CardHeader>
            <CardTitle className="text-base">Produits</CardTitle>
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Aucun produit. Ajoutez-en dans « Stock ».
              </p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addLine(p)}
                    className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-sm text-primary">{formatMoney(Number(p.sale_price))}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock : {Number(p.stock_qty)}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="no-print h-fit">
          <CardHeader>
            <CardTitle className="text-base">Panier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {lines.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Panier vide</p>
            ) : (
              <div className="space-y-2">
                {lines.map((l) => (
                  <div key={l.product.id} className="flex items-center gap-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{l.product.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatMoney(Number(l.product.sale_price))} × {l.qty}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.product.id, l.qty - 1)}
                    >
                      <Minus className="size-3" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.product.id, l.qty + 1)}
                    >
                      <Plus className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      onClick={() => setQty(l.product.id, 0)}
                    >
                      <Trash2 className="size-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 border-t border-border pt-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="text-lg font-semibold text-foreground">{formatMoney(total)}</span>
              </div>
              <div className="space-y-2">
                <Label htmlFor="client">Client (optionnel)</Label>
                <Input
                  id="client"
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paid">Montant reçu</Label>
                <Input
                  id="paid"
                  type="number"
                  value={paid}
                  onChange={(e) => setPaid(e.target.value)}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monnaie à rendre</span>
                <span className="font-medium text-foreground">
                  {formatMoney(change > 0 ? change : 0)}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={lines.length === 0 || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              Encaisser
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={receipt !== null} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="no-print">Fiche de vente</DialogTitle>
          </DialogHeader>
          {receipt ? (
            <div
              id="ticket"
              className="print-area mx-auto w-[58mm] max-w-full font-mono text-[11px] leading-tight"
            >
              <div className="text-center">
                {business?.logo ? (
                  <img
                    src={business.logo}
                    alt={`Logo de ${business.profile?.name || "l'entreprise"}`}
                    className="mx-auto mb-1 max-h-12 object-contain"
                  />
                ) : null}
                <p className="text-sm font-bold uppercase">
                  {business?.profile?.name?.trim() || "MiniPOS"}
                </p>
                {business?.profile?.address ? (
                  <p className="text-[10px]">{business.profile.address}</p>
                ) : null}
                {business?.profile?.phone ? (
                  <p className="text-[10px]">Tél : {business.profile.phone}</p>
                ) : null}
                <div className="my-1 border-t border-dashed border-border" />
                <p className="text-[10px]">Ticket #{receipt.ticket_no}</p>
                <p className="text-[10px]">{formatDate(receipt.created_at)}</p>
                {receipt.customer ? (
                  <p className="text-[10px]">Client : {receipt.customer}</p>
                ) : null}
              </div>

              <div className="my-2 border-t border-dashed border-border" />

              {receipt.lines.map((l, i) => (
                <div key={i} className="flex justify-between gap-1">
                  <span className="min-w-0 break-words">
                    {l.qty} × {l.name}
                  </span>
                  <span className="shrink-0">{formatMoney(l.qty * l.unit_price)}</span>
                </div>
              ))}
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex justify-between font-bold">
                <span>TOTAL</span>
                <span>{formatMoney(receipt.total)}</span>
              </div>
              <div className="flex justify-between">
                <span>Reçu</span>
                <span>{formatMoney(receipt.paid)}</span>
              </div>
              <div className="flex justify-between">
                <span>Monnaie</span>
                <span>{formatMoney(receipt.change_due)}</span>
              </div>
              <p className="mt-3 text-center text-[10px]">Merci de votre achat !</p>

            </div>
          ) : null}
          <DialogFooter className="no-print">
            <Button variant="outline" onClick={() => setReceipt(null)}>
              Fermer
            </Button>
            <Button onClick={() => window.print()}>
              <Printer className="size-4" /> Imprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
