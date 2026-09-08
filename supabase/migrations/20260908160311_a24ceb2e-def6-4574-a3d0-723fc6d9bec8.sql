CREATE TABLE public.presenter_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slide_id TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenter_notes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.presenter_notes TO anon;
GRANT ALL ON public.presenter_notes TO service_role;

ALTER TABLE public.presenter_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to presenter_notes"
ON public.presenter_notes FOR ALL USING (true);