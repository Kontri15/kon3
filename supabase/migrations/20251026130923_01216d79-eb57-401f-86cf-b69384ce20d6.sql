-- Drop existing RLS policy on tasks
DROP POLICY IF EXISTS "Users can manage own tasks" ON public.tasks;

-- Create public access policy for single-user app (matching blocks table)
CREATE POLICY "Public access for single-user app" 
ON public.tasks 
FOR ALL 
USING (true) 
WITH CHECK (true);
