
-- 1. Roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Account assignments
CREATE TABLE public.account_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id text NOT NULL,
  account_name text,
  platform text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (user_id, account_id, platform)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_assignments TO authenticated;
GRANT ALL ON public.account_assignments TO service_role;

ALTER TABLE public.account_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own assignments" ON public.account_assignments
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins insert assignments" ON public.account_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update assignments" ON public.account_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete assignments" ON public.account_assignments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_account_assignments_user ON public.account_assignments(user_id);
CREATE INDEX idx_account_assignments_account ON public.account_assignments(account_id);

-- 3. Restrict meta_datos read by assignment
DROP POLICY IF EXISTS "Authenticated users read meta_datos" ON public.meta_datos;

CREATE POLICY "Users read assigned meta_datos" ON public.meta_datos
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM public.account_assignments a
      WHERE a.user_id = auth.uid() AND a.account_id = meta_datos.account_id
    )
  );

-- 4. Seed: heider as admin + assign Kemmerling
INSERT INTO public.user_roles (user_id, role)
VALUES ('bf3a7f67-bebf-4ddb-afec-cff800b1053f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.account_assignments (user_id, account_id, account_name, platform, created_by)
VALUES ('bf3a7f67-bebf-4ddb-afec-cff800b1053f', '204109401', 'Kemmerling', 'META', 'bf3a7f67-bebf-4ddb-afec-cff800b1053f')
ON CONFLICT (user_id, account_id, platform) DO NOTHING;
