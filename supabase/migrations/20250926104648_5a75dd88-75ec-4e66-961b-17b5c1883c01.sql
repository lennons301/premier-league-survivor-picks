-- Add the missing trigger on gameweeks table
CREATE TRIGGER update_game_gameweeks_trigger
    AFTER UPDATE ON public.gameweeks
    FOR EACH ROW
    EXECUTE FUNCTION public.update_game_gameweeks_on_global_change();