-- Add description column to blocks table for detailed block information
-- (e.g., workout exercises, meal details, progression notes)
ALTER TABLE public.blocks
ADD COLUMN description text;