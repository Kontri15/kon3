-- Create daily_history table for tracking last 7 days
CREATE TABLE public.daily_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  date date NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Meals eaten
  lunch_meal text,
  dinner_meal text,
  
  -- Workout details
  workout_type text,
  workout_exercises jsonb,
  workout_completed boolean DEFAULT false,
  
  -- Recovery metrics (from WHOOP)
  recovery_pct integer,
  hrv_ms integer,
  sleep_hours decimal,
  
  -- General stats
  tasks_completed integer DEFAULT 0,
  total_work_minutes integer DEFAULT 0,
  
  -- Notes
  notes text
);

-- Enable RLS
ALTER TABLE public.daily_history ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (single-user app)
CREATE POLICY "Public access for single-user app"
ON public.daily_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Add meal_details and workout_details to blocks table
ALTER TABLE public.blocks 
ADD COLUMN meal_details text,
ADD COLUMN workout_details jsonb;

-- Create trigger for daily_history updated_at
CREATE TRIGGER update_daily_history_updated_at
BEFORE UPDATE ON public.daily_history
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();