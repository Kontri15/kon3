-- Update RLS policies for single-user app without authentication
DROP POLICY IF EXISTS "Users can view their own tokens" ON public.oauth_tokens;
DROP POLICY IF EXISTS "Users can insert their own tokens" ON public.oauth_tokens;
DROP POLICY IF EXISTS "Users can update their own tokens" ON public.oauth_tokens;
DROP POLICY IF EXISTS "Users can delete their own tokens" ON public.oauth_tokens;
DROP POLICY IF EXISTS "Users can manage own whoop data" ON public.whoop_daily;

-- Create public access policies for single-user app
CREATE POLICY "Public access for single-user app"
ON public.oauth_tokens
FOR ALL
USING (true)
WITH CHECK (true);

CREATE POLICY "Public access for single-user app"
ON public.whoop_daily
FOR ALL
USING (true)
WITH CHECK (true);