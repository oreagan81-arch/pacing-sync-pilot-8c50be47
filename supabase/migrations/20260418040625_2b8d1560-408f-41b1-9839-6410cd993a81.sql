CREATE OR REPLACE FUNCTION public.enforce_friday_rules()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Leave synthetic rows alone (Triple Logic siblings)
  IF NEW.is_synthetic THEN
    RETURN NEW;
  END IF;

  -- Friday rule: no homework assignments, no At Home (Tests OK)
  IF NEW.day = 'Friday' AND COALESCE(NEW.type, '') <> 'Test' THEN
    NEW.create_assign := false;
    NEW.at_home := NULL;
  END IF;

  -- Language Arts rule: only CP / Classroom Practice / Test create assignments
  IF NEW.subject = 'Language Arts'
     AND COALESCE(NEW.type, '') NOT IN ('CP', 'Classroom Practice', 'Test') THEN
    NEW.create_assign := false;
  END IF;

  -- History / Science rule: never create assignments (pages/announcements still render)
  IF NEW.subject IN ('History', 'Science') THEN
    NEW.create_assign := false;
  END IF;

  RETURN NEW;
END;
$function$;