-- Drop the existing restrictive RLS policy
DROP POLICY IF EXISTS "Users can manage own blocks" ON blocks;

-- Create a permissive policy for single-user app (no auth required)
CREATE POLICY "Public access for single-user app" 
ON blocks 
FOR ALL 
USING (true) 
WITH CHECK (true);