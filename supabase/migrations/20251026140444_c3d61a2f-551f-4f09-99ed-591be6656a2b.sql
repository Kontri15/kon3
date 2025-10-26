-- Drop foreign key constraints first
ALTER TABLE public.whoop_daily 
DROP CONSTRAINT IF EXISTS whoop_daily_user_id_fkey;

-- Change user_id from UUID to TEXT to support 'single-user' identifier
ALTER TABLE public.oauth_tokens 
ALTER COLUMN user_id TYPE TEXT;

ALTER TABLE public.whoop_daily 
ALTER COLUMN user_id TYPE TEXT;