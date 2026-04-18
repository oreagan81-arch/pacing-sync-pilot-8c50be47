
ALTER TABLE public.content_map
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS confidence text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS auto_linked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS content_map_subject_lesson_type_uniq
  ON public.content_map (subject, lesson_ref, COALESCE(type, ''));

ALTER TABLE public.files
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS canvas_url text,
  ADD COLUMN IF NOT EXISTS needs_rename boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS renamed_at timestamptz;
