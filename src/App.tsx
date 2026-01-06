import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Games from "./pages/Games";
import CreateGame from "./pages/CreateGame";
import GameDetail from "./pages/GameDetail";
import GameAdmin from "./pages/GameAdmin";
import GameProgress from "./pages/GameProgress";
import MakePick from "./pages/MakePick";
import TurboPick from "./pages/TurboPick";
import CupPick from "./pages/CupPick";
import EscalatingPick from "./pages/EscalatingPick";
import AdminPickEntry from "./pages/AdminPickEntry";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/games" element={<Games />} />
            <Route path="/games/create" element={<CreateGame />} />
            <Route path="/games/:gameId" element={<GameDetail />} />
            <Route path="/games/:gameId/pick" element={<MakePick />} />
            <Route path="/games/:gameId/turbo-pick" element={<TurboPick />} />
            <Route path="/games/:gameId/cup-pick" element={<CupPick />} />
            <Route path="/games/:gameId/escalating-pick" element={<EscalatingPick />} />
            <Route path="/games/:gameId/progress" element={<GameProgress />} />
            <Route path="/games/:gameId/admin" element={<GameAdmin />} />
            <Route path="/admin/pick-entry" element={<AdminPickEntry />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
