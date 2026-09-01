-- 1. Roles enum
CREATE TYPE public.app_role AS ENUM ('admin', 'caisse', 'comptabilite');

-- 2. Members table
CREATE TABLE public.org_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  display_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.org_members TO authenticated;
GRANT ALL ON public.org_members TO service_role;

ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_org_members_updated_at
BEFORE UPDATE ON public.org_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Backfill: every existing auth user becomes admin of its own shop
INSERT INTO public.org_members (user_id, owner_id, role)
SELECT u.id, u.id, 'admin'::public.app_role FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- 4. Helper functions (security definer, avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT owner_id FROM public.org_members WHERE user_id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.has_role(_role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE user_id = auth.uid() AND role = _role
  )
$$;

-- 5. org_members policies
CREATE POLICY "members read own org" ON public.org_members
FOR SELECT TO authenticated
USING (owner_id = public.current_org());

CREATE POLICY "admin manages members" ON public.org_members
FOR ALL TO authenticated
USING (owner_id = public.current_org() AND public.has_role('admin'))
WITH CHECK (owner_id = public.current_org() AND public.has_role('admin'));

-- 6. Add owner_id to data tables
ALTER TABLE public.products ADD COLUMN owner_id uuid;
UPDATE public.products SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.products ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.products ALTER COLUMN owner_id SET DEFAULT public.current_org();

ALTER TABLE public.expenses ADD COLUMN owner_id uuid;
UPDATE public.expenses SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.expenses ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.expenses ALTER COLUMN owner_id SET DEFAULT public.current_org();

ALTER TABLE public.sales ADD COLUMN owner_id uuid;
UPDATE public.sales SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.sales ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.sales ALTER COLUMN owner_id SET DEFAULT public.current_org();

ALTER TABLE public.sale_items ADD COLUMN owner_id uuid;
UPDATE public.sale_items SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.sale_items ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN owner_id SET DEFAULT public.current_org();

ALTER TABLE public.cash_sessions ADD COLUMN owner_id uuid;
UPDATE public.cash_sessions SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.cash_sessions ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.cash_sessions ALTER COLUMN owner_id SET DEFAULT public.current_org();

ALTER TABLE public.business_profiles ADD COLUMN owner_id uuid;
UPDATE public.business_profiles SET owner_id = user_id WHERE owner_id IS NULL;
ALTER TABLE public.business_profiles ALTER COLUMN owner_id SET NOT NULL;
ALTER TABLE public.business_profiles ALTER COLUMN owner_id SET DEFAULT public.current_org();

-- 7. Replace policies
DROP POLICY IF EXISTS "own products" ON public.products;
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

DROP POLICY IF EXISTS "own expenses" ON public.expenses;
CREATE POLICY "accounting manages expenses" ON public.expenses
FOR ALL TO authenticated
USING (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('comptabilite')))
WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('comptabilite')));

DROP POLICY IF EXISTS "own sales" ON public.sales;
CREATE POLICY "org reads sales" ON public.sales
FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse creates sales" ON public.sales
FOR INSERT TO authenticated
WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));
CREATE POLICY "admin deletes sales" ON public.sales
FOR DELETE TO authenticated
USING (owner_id = public.current_org() AND public.has_role('admin'));

DROP POLICY IF EXISTS "own sale items" ON public.sale_items;
CREATE POLICY "org reads sale items" ON public.sale_items
FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse creates sale items" ON public.sale_items
FOR INSERT TO authenticated
WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));
CREATE POLICY "admin deletes sale items" ON public.sale_items
FOR DELETE TO authenticated
USING (owner_id = public.current_org() AND public.has_role('admin'));

DROP POLICY IF EXISTS "own cash sessions" ON public.cash_sessions;
CREATE POLICY "org reads cash sessions" ON public.cash_sessions
FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "caisse manages cash sessions" ON public.cash_sessions
FOR ALL TO authenticated
USING (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')))
WITH CHECK (owner_id = public.current_org() AND (public.has_role('admin') OR public.has_role('caisse')));

DROP POLICY IF EXISTS "own business profile" ON public.business_profiles;
CREATE POLICY "org reads business profile" ON public.business_profiles
FOR SELECT TO authenticated USING (owner_id = public.current_org());
CREATE POLICY "admin manages business profile" ON public.business_profiles
FOR ALL TO authenticated
USING (owner_id = public.current_org() AND public.has_role('admin'))
WITH CHECK (owner_id = public.current_org() AND public.has_role('admin'));

-- 8. Logo storage readable by whole org
CREATE POLICY "org logos read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'logos' AND (storage.foldername(name))[1] = public.current_org()::text);