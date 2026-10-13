CREATE TABLE IF NOT EXISTS public.sync_locks (
  name text PRIMARY KEY,
  holder uuid NOT NULL,
  locked_until timestamptz NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.sync_locks FROM anon, authenticated;
GRANT ALL ON public.sync_locks TO service_role;
ALTER TABLE public.sync_locks ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.try_acquire_sync_lock(_name text, _holder uuid, _ttl_seconds integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE got uuid;
BEGIN
  INSERT INTO public.sync_locks AS l (name, holder, locked_until, acquired_at)
  VALUES (_name, _holder, now() + make_interval(secs => _ttl_seconds), now())
  ON CONFLICT (name) DO UPDATE
    SET holder = EXCLUDED.holder, locked_until = EXCLUDED.locked_until, acquired_at = EXCLUDED.acquired_at
    WHERE l.locked_until < now()
  RETURNING holder INTO got;
  RETURN got IS NOT DISTINCT FROM _holder;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_sync_lock(_name text, _holder uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.sync_locks WHERE name = _name AND holder = _holder;
$$;

REVOKE ALL ON FUNCTION public.try_acquire_sync_lock(text, uuid, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_sync_lock(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_acquire_sync_lock(text, uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_sync_lock(text, uuid) TO service_role;