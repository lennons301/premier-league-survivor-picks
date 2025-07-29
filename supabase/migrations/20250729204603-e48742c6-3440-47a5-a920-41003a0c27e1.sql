-- Add missing columns to games table
ALTER TABLE public.games 
ADD COLUMN IF NOT EXISTS entry_fee decimal(10,2) DEFAULT 10.00 NOT NULL,
ADD COLUMN IF NOT EXISTS winner_id uuid DEFAULT NULL;