-- Update system_config.auto_logic to add readingFluencyBenchmarks and remove '100 words per minute' from readingTestPhrases
UPDATE public.system_config
SET auto_logic = jsonb_set(
  jsonb_set(
    auto_logic,
    '{readingFluencyBenchmarks}',
    '{"1-7": {"wpm": 100, "errors": 2}, "8-10": {"wpm": 115, "errors": 2}, "11-13": {"wpm": 130, "errors": 2}}'::jsonb
  ),
  '{readingTestPhrases}',
  '["tracking and tapping"]'::jsonb
)
WHERE id = 'current';
