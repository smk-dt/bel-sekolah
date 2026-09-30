-- Drop old check constraint on day
ALTER TABLE public.schedules DROP CONSTRAINT IF EXISTS schedules_day_check;

-- Add track column
ALTER TABLE public.schedules ADD COLUMN IF NOT EXISTS track smallint NOT NULL DEFAULT 1;

-- Backfill from audios if audio_id column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'audio_id'
  ) THEN
    UPDATE public.schedules
    SET track = a.file_number
    FROM public.audios a
    WHERE public.schedules.audio_id = a.id;

    ALTER TABLE public.schedules DROP COLUMN audio_id;
  END IF;
END $$;

-- Convert day from text to smallint if it is text
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'schedules' AND column_name = 'day' AND data_type = 'text'
  ) THEN
    ALTER TABLE public.schedules ALTER COLUMN day TYPE smallint USING (
      case day
        when 'monday' then 1
        when 'tuesday' then 2
        when 'wednesday' then 3
        when 'thursday' then 4
        when 'friday' then 5
        when 'saturday' then 6
        when 'sunday' then 7
        else 0
      end
    );
  END IF;
END $$;

-- Add new check constraint for day (0=every day, 1=Mon..7=Sun)
ALTER TABLE public.schedules ADD CONSTRAINT schedules_day_check CHECK (day >= 0 AND day <= 7);

-- Drop unused scadule table
DROP TABLE IF EXISTS public.scadule;