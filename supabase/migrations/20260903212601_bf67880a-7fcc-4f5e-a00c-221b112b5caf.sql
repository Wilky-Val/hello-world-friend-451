CREATE TABLE public.platform_admins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.platform_admins TO authenticated;
GRANT ALL ON public.platform_admins TO service_role;
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read own platform admin row" ON public.platform_admins FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = auth.uid())
$$;
REVOKE ALL ON FUNCTION public.is_platform_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated, service_role;

CREATE TABLE public.org_status (
  owner_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  note text,
  disabled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.org_status TO authenticated;
GRANT ALL ON public.org_status TO service_role;
ALTER TABLE public.org_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin manages org status" ON public.org_status FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
CREATE POLICY "members read own org status" ON public.org_status FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.org_members m WHERE m.user_id = auth.uid() AND m.owner_id = org_status.owner_id));
CREATE TRIGGER update_org_status_updated_at BEFORE UPDATE ON public.org_status
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.current_org()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.owner_id
  FROM public.org_members m
  LEFT JOIN public.org_status s ON s.owner_id = m.owner_id
  WHERE m.user_id = auth.uid()
    AND COALESCE(s.active, true)
$$;

INSERT INTO public.org_status (owner_id, active)
SELECT DISTINCT owner_id, true FROM public.org_members
ON CONFLICT (owner_id) DO NOTHING;

INSERT INTO public.platform_admins (user_id)
VALUES ('b7296b72-201a-4de0-82b3-4abb25955bdc')
ON CONFLICT (user_id) DO NOTHING;