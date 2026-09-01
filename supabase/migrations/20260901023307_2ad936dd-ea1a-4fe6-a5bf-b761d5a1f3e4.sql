REVOKE ALL ON FUNCTION public.current_org() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_org() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(public.app_role) TO authenticated, service_role;