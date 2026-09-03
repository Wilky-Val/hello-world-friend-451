import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useBusiness } from "@/lib/business";
import { formatDate, formatMoney, type Sale, type SaleItem } from "@/lib/pos";

export const Route = createFileRoute("/_authenticated/rapport")({
  head: () => ({
    meta: [
      { title: "Rapport du jour — Ventes et articles vendus — MiniPOS" },
      {
        name: "description",
        content:
          "Générez un rapport PDF des ventes du jour avec le numéro de chaque fiche et le détail des articles vendus.",
      },
      { property: "og:title", content: "Rapport du jour — MiniPOS" },
      {
        property: "og:description",
        content: "Rapport PDF des ventes du jour, fiche par fiche, avec les articles vendus.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReportPage,
});

function todayISO() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 10);
}

type SaleWithItems = Sale & { items: SaleItem[] };

function ReportPage() {
  const [day, setDay] = useState(todayISO());
  const { data: business } = useBusiness();
  const [building, setBuilding] = useState(false);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["report-sales", day],
    queryFn: async (): Promise<SaleWithItems[]> => {
      const start = new Date(`${day}T00:00:00`);
      const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
      const { data: rows, error } = await supabase
        .from("sales")
        .select("*")
        .gte("created_at", start.toISOString())
        .lt("created_at", end.toISOString())
        .order("ticket_no", { ascending: true });
      if (error) throw error;
      const list = (rows ?? []) as Sale[];
      if (list.length === 0) return [];
      const { data: items, error: itemsError } = await supabase
        .from("sale_items")
        .select("*")
        .in(
          "sale_id",
          list.map((s) => s.id),
        );
      if (itemsError) throw itemsError;
      const bySale = new Map<string, SaleItem[]>();
      for (const it of (items ?? []) as SaleItem[]) {
        const arr = bySale.get(it.sale_id) ?? [];
        arr.push(it);
        bySale.set(it.sale_id, arr);
      }
      return list.map((s) => ({ ...s, items: bySale.get(s.id) ?? [] }));
    },
  });

  const total = sales.reduce((sum, s) => sum + Number(s.total), 0);
  const cost = sales.reduce((sum, s) => sum + Number(s.cost_total), 0);
  const articles = sales.reduce(
    (sum, s) => sum + s.items.reduce((n, i) => n + Number(i.qty), 0),
    0,
  );

  async function generatePdf() {
    if (sales.length === 0) {
      toast.error("Aucune vente pour cette date");
      return;
    }
    setBuilding(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const left = 40;
      let y = 48;

      const shop = business?.profile?.name?.trim() || "MiniPOS";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(shop, pageW / 2, y, { align: "center" });
      y += 16;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      if (business?.profile?.address) {
        doc.text(business.profile.address, pageW / 2, y, { align: "center" });
        y += 12;
      }
      if (business?.profile?.phone) {
        doc.text(`Tel : ${business.profile.phone}`, pageW / 2, y, { align: "center" });
        y += 12;
      }
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(
        `Rapport des ventes du ${new Date(`${day}T00:00:00`).toLocaleDateString("fr-FR")}`,
        pageW / 2,
        y,
        { align: "center" },
      );
      y += 20;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Nombre de fiches : ${sales.length}`, left, y);
      doc.text(`Articles vendus : ${articles}`, left + 200, y);
      y += 14;
      doc.text(`Total des ventes : ${formatMoney(total)}`, left, y);
      doc.text(`Bénéfice brut : ${formatMoney(total - cost)}`, left + 200, y);
      y += 16;
      doc.setDrawColor(150);
      doc.line(left, y, pageW - left, y);
      y += 18;

      const ensure = (needed: number) => {
        if (y + needed > pageH - 50) {
          doc.addPage();
          y = 48;
        }
      };

      for (const s of sales) {
        ensure(60);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(`Fiche #${s.ticket_no}`, left, y);
        doc.text(formatMoney(Number(s.total)), pageW - left, y, { align: "right" });
        y += 13;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.text(
          `${formatDate(s.created_at)}${s.customer ? ` — Client : ${s.customer}` : ""}`,
          left,
          y,
        );
        y += 14;

        doc.setFont("helvetica", "bold");
        doc.text("Article", left + 10, y);
        doc.text("Qté", left + 250, y, { align: "right" });
        doc.text("P.U.", left + 340, y, { align: "right" });
        doc.text("Montant", pageW - left, y, { align: "right" });
        y += 11;
        doc.setFont("helvetica", "normal");

        for (const it of s.items) {
          ensure(20);
          const name = doc.splitTextToSize(it.product_name, 220)[0] as string;
          doc.text(name, left + 10, y);
          doc.text(String(Number(it.qty)), left + 250, y, { align: "right" });
          doc.text(formatMoney(Number(it.unit_price)), left + 340, y, { align: "right" });
          doc.text(formatMoney(Number(it.qty) * Number(it.unit_price)), pageW - left, y, {
            align: "right",
          });
          y += 12;
        }
        y += 4;
        doc.setDrawColor(210);
        doc.line(left, y, pageW - left, y);
        y += 16;
      }

      ensure(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`TOTAL DU JOUR : ${formatMoney(total)}`, pageW - left, y, { align: "right" });

      doc.save(`rapport-ventes-${day}.pdf`);
      toast.success("Rapport PDF généré");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la génération");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <AppShell
      title="Rapport du jour"
      subtitle="Toutes les fiches de vente et les articles vendus, exportables en PDF"
      allow={["admin", "caisse", "comptabilite"]}
    >
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="day">Date</Label>
            <Input
              id="day"
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Fiches</p>
            <p className="font-semibold text-foreground">{sales.length}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Articles vendus</p>
            <p className="font-semibold text-foreground">{articles}</p>
          </div>
          <div className="text-sm">
            <p className="text-muted-foreground">Total</p>
            <p className="font-semibold text-primary">{formatMoney(total)}</p>
          </div>
          <Button className="ml-auto" disabled={building || isLoading} onClick={generatePdf}>
            <FileDown className="size-4" /> Générer le PDF
          </Button>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Chargement...</p>
      ) : sales.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune vente pour cette date.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sales.map((s) => (
            <Card key={s.id}>
              <CardHeader className="flex-row items-center justify-between gap-2 pb-2">
                <div>
                  <CardTitle className="text-base">Fiche #{s.ticket_no}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(s.created_at)}
                    {s.customer ? ` — ${s.customer}` : ""}
                  </p>
                </div>
                <span className="font-semibold text-primary">{formatMoney(Number(s.total))}</span>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {s.items.map((it) => (
                    <div key={it.id} className="flex justify-between gap-2">
                      <span className="min-w-0 truncate text-foreground">
                        {Number(it.qty)} × {it.product_name}
                      </span>
                      <span className="text-muted-foreground">
                        {formatMoney(Number(it.qty) * Number(it.unit_price))}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </AppShell>
  );
}
