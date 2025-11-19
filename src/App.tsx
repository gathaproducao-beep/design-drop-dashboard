import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Mockups from "./pages/Mockups";
import MensagensWhatsapp from "./pages/MensagensWhatsapp";
import ConfiguracoesWhatsapp from "./pages/ConfiguracoesWhatsapp";
import FilaWhatsapp from "./pages/FilaWhatsapp";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/mockups" element={<Mockups />} />
          <Route path="/mensagens" element={<MensagensWhatsapp />} />
          <Route path="/fila-whatsapp" element={<FilaWhatsapp />} />
          <Route path="/configuracoes-whatsapp" element={<ConfiguracoesWhatsapp />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
