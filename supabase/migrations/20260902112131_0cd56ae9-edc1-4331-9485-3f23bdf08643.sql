CREATE OR REPLACE FUNCTION public.is_member()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.org_members WHERE user_id = auth.uid())
$$;

REVOKE ALL ON FUNCTION public.is_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member() TO authenticated, service_role;

CREATE POLICY "bootstrap own shop" ON public.org_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND owner_id = auth.uid()
  AND role = 'admin'::public.app_role
  AND NOT public.is_member()
);

CREATE POLICY "read own membership" ON public.org_members
FOR SELECT TO authenticated
USING (user_id = auth.uid());