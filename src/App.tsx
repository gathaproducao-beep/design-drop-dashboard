import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Mockups from "./pages/Mockups";
import MensagensWhatsapp from "./pages/MensagensWhatsapp";
import ConfiguracoesWhatsapp from "./pages/ConfiguracoesWhatsapp";
import ConfiguracoesDrive from "./pages/ConfiguracoesDrive";
import FilaWhatsapp from "./pages/FilaWhatsapp";
import Auth from "./pages/Auth";
import GestaoUsuarios from "./pages/GestaoUsuarios";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/mockups" element={<ProtectedRoute><Mockups /></ProtectedRoute>} />
          <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
          <Route path="/mensagens" element={<ProtectedRoute><MensagensWhatsapp /></ProtectedRoute>} />
          <Route path="/fila-whatsapp" element={<ProtectedRoute><FilaWhatsapp /></ProtectedRoute>} />
          <Route path="/configuracoes-whatsapp" element={<ProtectedRoute><ConfiguracoesWhatsapp /></ProtectedRoute>} />
          <Route path="/configuracoes-drive" element={<ProtectedRoute><ConfiguracoesDrive /></ProtectedRoute>} />
          <Route path="/gestao-usuarios" element={<ProtectedRoute><GestaoUsuarios /></ProtectedRoute>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
