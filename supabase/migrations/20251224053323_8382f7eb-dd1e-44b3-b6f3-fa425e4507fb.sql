-- Add RLS policy to allow users to delete their own picks
CREATE POLICY "Users can delete their own picks"
ON public.picks
FOR DELETE
USING (auth.uid() = user_id);