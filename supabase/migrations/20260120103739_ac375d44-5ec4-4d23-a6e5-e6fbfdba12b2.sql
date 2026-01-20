
-- Fix game winners for "New Year New LPS"
-- All players were eliminated in GW22, so it's a split pot between vishalshah10121981 and barryg2hw

-- Delete incorrect winner (Sarit)
DELETE FROM game_winners 
WHERE game_id = 'af26e727-477d-48fe-806f-895914fd3847';

-- Insert correct split winners (£280 pot / 2 = £140 each)
INSERT INTO game_winners (game_id, user_id, payout_amount, is_split)
VALUES 
  ('af26e727-477d-48fe-806f-895914fd3847', '126d4798-6baa-4f2f-b523-54af4a52484d', 140.00, true),  -- vishalshah10121981
  ('af26e727-477d-48fe-806f-895914fd3847', '0aa64039-b0ba-4544-a53d-1fa581fe3111', 140.00, true);  -- barryg2hw
