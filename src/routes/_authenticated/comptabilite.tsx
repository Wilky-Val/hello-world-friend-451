import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDate, formatMoney, type Expense, type Sale } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/comptabilite")({
  head: () => ({
    meta: [
      { title: "Comptabilité — Dépenses et bénéfice — MiniPOS" },
      {
        name: "description",
        content:
          "Suivez vos dépenses, le coût d'achat des produits vendus, le chiffre d'affaires et le bénéfice net.",
      },
      { property: "og:title", content: "Comptabilité — MiniPOS" },
      {
        property: "og:description",
        content: "Dépenses, prix d'achat des produits vendus et bénéfice net.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountingPage,
});

function AccountingPage() {
  const qc = useQueryClient();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("general");
  const [amount, setAmount] = useState("");

  const { data: sales = [] } = useQuery({
    queryKey: ["sales"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("spent_at", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

  const addExpense = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) throw new Error("Session expirée");
      const { error } = await supabase.from("expenses").insert({
        user_id: uid,
        label: label.trim(),
        category: category.trim() || "general",
        amount: Number(amount) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      setLabel("");
      setAmount("");
      toast.success("Dépense enregistrée");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const removeExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const cogs = sales.reduce((s, x) => s + Number(x.cost_total), 0);
  const grossProfit = revenue - cogs;
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const netProfit = grossProfit - totalExpenses;

  const stats = [
    { label: "Chiffre d'affaires", value: revenue },
    { label: "Prix d'achat des produits vendus", value: cogs },
    { label: "Bénéfice brut", value: grossProfit },
    { label: "Dépenses", value: totalExpenses },
    { label: "Bénéfice net", value: netProfit, highlight: true },
  ];

  return (
    <AppShell title="Comptabilité" subtitle="Dépenses, coût d'achat et bénéfice" allow={["admin", "comptabilite"]}>
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((s) => (
          <Card key={s.label} className={s.highlight ? "border-primary/40 bg-primary/5" : undefined}>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p
                className={`mt-1 text-lg font-semibold ${
                  s.highlight
                    ? s.value >= 0
                      ? "text-primary"
                      : "text-destructive"
                    : "text-foreground"
                }`}
              >
                {formatMoney(s.value)}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nouvelle dépense</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Libellé</Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Loyer, transport, électricité..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Catégorie</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Montant</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <Button
              className="w-full"
              disabled={!label.trim() || !amount || addExpense.isPending}
              onClick={() => addExpense.mutate()}
            >
              <Plus className="size-4" /> Ajouter la dépense
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dépenses ({expenses.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border text-left text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2 font-medium">Libellé</th>
                  <th className="px-4 py-2 font-medium">Catégorie</th>
                  <th className="px-4 py-2 text-right font-medium">Montant</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                      Aucune dépense enregistrée.
                    </td>
                  </tr>
                ) : (
                  expenses.map((e) => (
                    <tr key={e.id} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-2 text-muted-foreground">{e.spent_at}</td>
                      <td className="px-4 py-2 font-medium text-foreground">{e.label}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.category}</td>
                      <td className="px-4 py-2 text-right">{formatMoney(Number(e.amount))}</td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeExpense.mutate(e.id)}
                        >
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
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Dernières ventes</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-muted-foreground">
              <tr>
                <th className="px-4 py-2 font-medium">Ticket</th>
                <th className="px-4 py-2 font-medium">Date</th>
                <th className="px-4 py-2 text-right font-medium">Total</th>
                <th className="px-4 py-2 text-right font-medium">Coût</th>
                <th className="px-4 py-2 text-right font-medium">Bénéfice</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                    Aucune vente pour le moment.
                  </td>
                </tr>
              ) : (
                sales.slice(0, 15).map((s) => (
                  <tr key={s.id} className="border-b border-border/60 last:border-0">
                    <td className="px-4 py-2 font-medium">#{s.ticket_no}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatDate(s.created_at)}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(Number(s.total))}</td>
                    <td className="px-4 py-2 text-right">{formatMoney(Number(s.cost_total))}</td>
                    <td className="px-4 py-2 text-right text-primary">
                      {formatMoney(Number(s.total) - Number(s.cost_total))}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </AppShell>
  );
}
