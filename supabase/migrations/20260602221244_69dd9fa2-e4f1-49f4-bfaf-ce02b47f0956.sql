-- Restrict SECURITY DEFINER has_role to authenticated only
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Revoke anon SELECT on all user-scoped tables (none should be discoverable pre-login)
REVOKE SELECT ON public.account_assignments FROM anon;
REVOKE SELECT ON public.alert_settings FROM anon;
REVOKE SELECT ON public.audit_records FROM anon;
REVOKE SELECT ON public.brand_briefs FROM anon;
REVOKE SELECT ON public.campaign_tracking FROM anon;
REVOKE SELECT ON public.data_sources FROM anon;
REVOKE SELECT ON public.meta_datos FROM anon;
REVOKE SELECT ON public.user_roles FROM anon;