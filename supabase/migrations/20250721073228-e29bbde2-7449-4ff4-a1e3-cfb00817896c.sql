-- Insert some test users and add them to the profiles table for testing
-- First, let's create some sample profiles for testing (these will have fake user_ids for now)
INSERT INTO public.profiles (user_id, display_name) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Test User A'),
  ('22222222-2222-2222-2222-222222222222', 'Test User B'),
  ('33333333-3333-3333-3333-333333333333', 'Test User C'),
  ('44444444-4444-4444-4444-444444444444', 'Test User D'),
  ('55555555-5555-5555-5555-555555555555', 'Test User E')
ON CONFLICT (user_id) DO NOTHING;