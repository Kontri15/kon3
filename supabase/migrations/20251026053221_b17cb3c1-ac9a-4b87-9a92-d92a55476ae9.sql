-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE location_type AS ENUM ('BA', 'SNV', 'ANY');
CREATE TYPE block_type AS ENUM ('task', 'ritual', 'event', 'meal', 'sleep', 'buffer', 'commute');
CREATE TYPE block_status AS ENUM ('planned', 'active', 'done', 'moved', 'canceled');
CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done');
CREATE TYPE biz_type AS ENUM ('biz', 'personal');
CREATE TYPE event_source AS ENUM ('outlook', 'sports');
CREATE TYPE meal_kind AS ENUM ('breakfast', 'lunch', 'dinner', 'snack');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  chronotype TEXT DEFAULT 'standard',
  home_city location_type DEFAULT 'BA',
  build_mode BOOLEAN DEFAULT false,
  sleep_target_min INTEGER DEFAULT 450,
  bedtime TIME DEFAULT '22:00',
  prebed_start TIME DEFAULT '21:30',
  work_arrival TIME DEFAULT '08:30',
  work_leave TIME DEFAULT '16:30',
  friday_home_office BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Rituals table
CREATE TABLE public.rituals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  days_of_week TEXT[] DEFAULT '{}',
  preferred_start TIME,
  preferred_end TIME,
  duration_min INTEGER NOT NULL,
  flex_min INTEGER DEFAULT 15,
  location location_type DEFAULT 'ANY',
  hard_fixed BOOLEAN DEFAULT false,
  pre_buffer_min INTEGER DEFAULT 0,
  post_buffer_min INTEGER DEFAULT 0,
  consistency_weight INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rituals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own rituals" ON public.rituals
  FOR ALL USING (auth.uid() = user_id);

-- Tasks table
CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  project TEXT,
  tags TEXT[] DEFAULT '{}',
  location location_type DEFAULT 'ANY',
  due_at TIMESTAMPTZ,
  earliest_start TIMESTAMPTZ,
  hard_window_start TIMESTAMPTZ,
  hard_window_end TIMESTAMPTZ,
  priority INTEGER DEFAULT 2,
  impact INTEGER DEFAULT 2,
  energy_need INTEGER DEFAULT 2,
  est_min INTEGER,
  min_block_min INTEGER DEFAULT 25,
  dependencies UUID[] DEFAULT '{}',
  recurrence TEXT,
  status task_status DEFAULT 'todo',
  actual_min INTEGER,
  confidence FLOAT DEFAULT 0.5,
  biz_or_personal biz_type DEFAULT 'personal',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own tasks" ON public.tasks
  FOR ALL USING (auth.uid() = user_id);

-- Blocks table
CREATE TABLE public.blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  ritual_id UUID REFERENCES public.rituals(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  type block_type NOT NULL,
  status block_status DEFAULT 'planned',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own blocks" ON public.blocks
  FOR ALL USING (auth.uid() = user_id);

-- Events table (synced from external sources)
CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source event_source NOT NULL,
  external_id TEXT,
  title TEXT NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  hard_fixed BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, source, external_id)
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own events" ON public.events
  FOR ALL USING (auth.uid() = user_id);

-- Meals table
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind meal_kind NOT NULL,
  calories INTEGER,
  protein_g INTEGER,
  carbs_g INTEGER,
  fat_g INTEGER,
  duration_min INTEGER DEFAULT 30,
  rotation_weight INTEGER DEFAULT 1,
  components TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meals" ON public.meals
  FOR ALL USING (auth.uid() = user_id);

-- Supplements table
CREATE TABLE public.supplements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  timing_rule TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.supplements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own supplements" ON public.supplements
  FOR ALL USING (auth.uid() = user_id);

-- WHOOP daily data
CREATE TABLE public.whoop_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recovery_pct INTEGER,
  hrv_ms INTEGER,
  rhr_bpm INTEGER,
  sleep_perf_pct INTEGER,
  sleep_start TIMESTAMPTZ,
  sleep_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.whoop_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own whoop data" ON public.whoop_daily
  FOR ALL USING (auth.uid() = user_id);

-- Velocity tracking by tag
CREATE TABLE public.velocity_by_tag (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  avg_min_per_point FLOAT,
  samples INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, tag)
);

ALTER TABLE public.velocity_by_tag ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own velocity data" ON public.velocity_by_tag
  FOR ALL USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rituals_updated_at BEFORE UPDATE ON public.rituals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_blocks_updated_at BEFORE UPDATE ON public.blocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_events_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_meals_updated_at BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_velocity_updated_at BEFORE UPDATE ON public.velocity_by_tag
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for common queries
CREATE INDEX idx_tasks_user_status ON public.tasks(user_id, status);
CREATE INDEX idx_tasks_due_at ON public.tasks(due_at) WHERE status != 'done';
CREATE INDEX idx_blocks_user_time ON public.blocks(user_id, start_at, end_at);
CREATE INDEX idx_events_user_time ON public.events(user_id, start_at, end_at);
CREATE INDEX idx_whoop_user_date ON public.whoop_daily(user_id, date DESC);