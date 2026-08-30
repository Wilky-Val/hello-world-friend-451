import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Receipt, Wallet } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MiniPOS — Caisse, stock et comptabilité simple" },
      {
        name: "description",
        content:
          "Application POS simple : gestion de stock, dépenses et bénéfice, caisse avec ticket imprimable.",
      },
      { property: "og:title", content: "MiniPOS — Caisse, stock et comptabilité" },
      {
        property: "og:description",
        content: "Gérez votre stock, vos dépenses et vos ventes avec fiche imprimable.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const FEATURES = [
  {
    icon: Package,
    title: "Gestion de stock",
    text: "Produits, quantités disponibles, prix d'achat et prix de vente.",
  },
  {
    icon: Wallet,
    title: "Comptabilité",
    text: "Dépenses, coût d'achat des produits vendus et bénéfice net.",
  },
  {
    icon: Receipt,
    title: "Caisse",
    text: "Encaissement rapide, monnaie à rendre et fiche à imprimer.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl px-4 py-20">
        <p className="text-sm font-medium tracking-widest text-primary uppercase">
          Point de vente
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          Mini<span className="text-primary">POS</span> — votre boutique, sans complication
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Trois fonctions essentielles : le stock, la comptabilité et la caisse avec ticket
          imprimable.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            to="/caisse"
            className="inline-flex items-center justify-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ouvrir la caisse
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Se connecter
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="size-5 text-primary" />
              <h2 className="mt-3 font-medium text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
