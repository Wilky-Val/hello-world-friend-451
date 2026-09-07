-- ============================================================
-- Initialisation de la base de données pour le projet POS
-- À exécuter dans l'éditeur SQL de ton projet Supabase
-- ============================================================

-- 1. Enum des rôles
CREATE TYPE public.app_role AS ENUM ('admin', 'caisse', 'comptabilite');

-- 2. Tables principales
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL,
  sku TEXT,
  stock_qty NUMERIC NOT NULL DEFAULT 0,
  cost_price NUMERIC NOT NULL DEFAULT 0,
  sale_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  amount NUMERIC NOT NULL DEFAULT 0,
  spent_at DATE NOT NULL DEFAULT current_date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE SEQUENCE public.sales_ticket_seq;

CREATE TABLE public.sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  ticket_no BIGINT NOT NULL DEFAULT nextval('public.sales_ticket_seq'),
  total NUMERIC NOT NULL DEFAULT 0,
  cost_total NUMERIC NOT NULL DEFAULT 0,
  paid NUMERIC NOT NULL DEFAULT 0,
  change_due NUMERIC NOT NULL DEFAULT 0,
  customer TEXT,
  cashier_name TEXT,
  session_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sale_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  qty NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.business_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  name TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.cash_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL DEFAULT auth.uid(),
  cashier_name TEXT,
  opening_amount NUMERIC NOT NULL DEFAULT 0,
  closing_amount NUMERIC,
  counted_amount NUMERIC,
  note TEXT,
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.org_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.org_status (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  disabled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Index
CREATE INDEX idx_products_user ON public.products(user_id);
CREATE INDEX idx_expenses_user ON public.expenses(user_id);
CREATE INDEX idx_sales_user ON public.sales(user_id);
CREATE INDEX idx_sale_items_sale ON public.sale_items(sale_id);
CREATE UNIQUE INDEX one_open_session_per_user ON public.cash_sessions (user_id) WHERE closed_at IS NULL;

-- 4. Séquence : droits
GRANT USAGE, SELECT ON SEQUENCE public.sales_ticket_seq TO authenticated;

-- 5. Fonctions utilitaires (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE OR REPLACE FUNCTION public.current_org()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.owner_id
  FROM public.org_members m
  LEFT JOIN public.org_status s ON s.owner_id = m.owner_id
  WHERE m.user_id = auth.uid()
    AND COALESCE(s.active, true);
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid() AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_member()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid());
$$;

REVOKE ALL ON FUNCTION public.current_org() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_member() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_member() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

-- 6. Triggers update_updated_at
CREATE TRIGGER update_business_profiles_updated_at
BEFORE UPDATE ON public.business_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cash_sessions_updated_at
BEFORE UPDATE ON public.cash_sessions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_members_updated_at
BEFORE UPDATE ON public.org_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_org_status_updated_at
BEFORE UPDATE ON public.org_status FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Clé étrangère sales -> cash_sessions
ALTER TABLE public.sales ADD CONSTRAINT sales_session_id_fkey
  FOREIGN KEY (session_id) REFERENCES public.cash_sessions(id) ON DELETE SET NULL;

-- 8. Droits Data API (nécessaires pour PostgREST/Supabase)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_sessions TO authenticated;
GRANT SELECT ON public.org_status TO authenticated;
GRANT SELECT ON public.platform_admins TO authenticated;

GRANT ALL ON public.products TO service_role;
GRANT ALL ON public.expenses TO service_role;
GRANT ALL ON public.sales TO service_role;
GRANT ALL ON public.sale_items TO service_role;
GRANT ALL ON public.business_profiles TO service_role;
GRANT ALL ON public.cash_sessions TO service_role;
GRANT ALL ON public.org_members TO service_role;
GRANT ALL ON public.org_status TO service_role;
GRANT ALL ON public.platform_admins TO service_role;

-- 9. Activer RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.org_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- 10. Politiques RLS
-- products
CREATE POLICY "org reads products" ON public.products
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "admin writes products" ON public.products
  FOR ALL TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('admin'))
  WITH CHECK (owner_id = public.current_org() AND public.has_role('admin'));
CREATE POLICY "caisse updates stock" ON public.products
  FOR UPDATE TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('caisse'))
  WITH CHECK (owner_id = public.current_org() AND public.has_role('caisse'));

-- expenses
CREATE POLICY "accounting manages expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('comptabilite')))
  WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('comptabilite')));

-- sales
CREATE POLICY "org reads sales" ON public.sales
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse creates sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));
CREATE POLICY "admin deletes sales" ON public.sales
  FOR DELETE TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('admin'));

-- sale_items
CREATE POLICY "org reads sale items" ON public.sale_items
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse creates sale items" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));
CREATE POLICY "admin deletes sale items" ON public.sale_items
  FOR DELETE TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('admin'));

-- business_profiles
CREATE POLICY "org reads business profile" ON public.business_profiles
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "admin manages business profile" ON public.business_profiles
  FOR ALL TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('admin'))
  WITH CHECK (owner_id = public.current_org() AND public.has_role('admin'));

-- cash_sessions
CREATE POLICY "org reads cash sessions" ON public.cash_sessions
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse manages cash sessions" ON public.cash_sessions
  FOR ALL TO authenticated
  USING (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')))
  WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));

-- org_members
CREATE POLICY "members read own org" ON public.org_members
  FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "admin manages members" ON public.org_members
  FOR ALL TO authenticated
  USING (owner_id = public.current_org() AND public.has_role('admin'))
  WITH CHECK (owner_id = public.current_org() AND public.has_role('admin'));
CREATE POLICY "read own membership" ON public.org_members
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- org_status
CREATE POLICY "platform admin manages org status" ON public.org_status
  FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "members read own org status" ON public.org_status
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND m.owner_id = org_status.owner_id));

-- platform_admins
CREATE POLICY "read own platform admin row" ON public.platform_admins
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 11. Storage bucket logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE storage.buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own logos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "own logos delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "org logos read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = public.current_org()::text);

-- ============================================================
-- IMPORTANT : créer le super administrateur
-- ============================================================
-- 1. Va dans Authentication > Users et crée un utilisateur (email + mot de passe).
-- 2. Récupère son UUID (colonne id).
-- 3. Remplace '<TON_UUID>' ci-dessous, puis exécute la ligne.
--
-- INSERT INTO public.platform_admins (user_id) VALUES ('<TON_UUID>');
