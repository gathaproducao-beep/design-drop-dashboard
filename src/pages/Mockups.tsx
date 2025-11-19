import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { MockupsList } from "@/components/mockups/MockupsList";
import { NovoMockupDialog } from "@/components/mockups/NovoMockupDialog";
import { MockupEditor } from "@/components/mockups/MockupEditor";
import { Navigation } from "@/components/Navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

export default function Mockups() {
  const [mockups, setMockups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoMockupOpen, setNovoMockupOpen] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<any>(null);
  const [filtroNome, setFiltroNome] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [paginaAtual, setPaginaAtual] = useState(1);
  const itensPorPagina = 9;

  useEffect(() => {
    carregarMockups();
  }, []);

  useEffect(() => {
    setPaginaAtual(1);
  }, [filtroNome, filtroTipo]);

  const carregarMockups = async () => {
    try {
      const { data, error } = await supabase
        .from("mockups")
        .select("*, mockup_areas(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMockups(data || []);
    } catch (error) {
      console.error("Erro ao carregar mockups:", error);
      toast.error("Erro ao carregar mockups");
    } finally {
      setLoading(false);
    }
  };

  const mockupsFiltrados = mockups.filter((mockup) => {
    const matchNome = mockup.codigo_mockup
      .toLowerCase()
      .includes(filtroNome.toLowerCase());
    const matchTipo = filtroTipo === "todos" || mockup.tipo === filtroTipo;
    return matchNome && matchTipo;
  });

  const totalPaginas = Math.ceil(mockupsFiltrados.length / itensPorPagina);
  const indiceInicio = (paginaAtual - 1) * itensPorPagina;
  const indiceFim = indiceInicio + itensPorPagina;
  const mockupsPaginados = mockupsFiltrados.slice(indiceInicio, indiceFim);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {selectedMockup ? (
          <MockupEditor
            mockup={selectedMockup}
            onClose={() => setSelectedMockup(null)}
            onSave={carregarMockups}
          />
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  Mockups
                </h1>
                <p className="text-muted-foreground">
                  Gerencie templates de mockups e suas áreas editáveis
                </p>
              </div>
              <Button
                onClick={() => setNovoMockupOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Mockup
              </Button>
            </div>

            <div className="mb-6 flex gap-4 items-center">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome..."
                  value={filtroNome}
                  onChange={(e) => setFiltroNome(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filtrar por tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os tipos</SelectItem>
                  <SelectItem value="aprovacao">Aprovação</SelectItem>
                  <SelectItem value="molde">Molde</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <MockupsList
              mockups={mockupsPaginados}
              loading={loading}
              onEdit={setSelectedMockup}
              onRefresh={carregarMockups}
            />

            {totalPaginas > 1 && (
              <div className="mt-8">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setPaginaAtual((p) => Math.max(1, p - 1))}
                        className={paginaAtual === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPaginas }, (_, i) => i + 1).map((pagina) => (
                      <PaginationItem key={pagina}>
                        <PaginationLink
                          onClick={() => setPaginaAtual(pagina)}
                          isActive={paginaAtual === pagina}
                          className="cursor-pointer"
                        >
                          {pagina}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setPaginaAtual((p) => Math.min(totalPaginas, p + 1))}
                        className={paginaAtual === totalPaginas ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}

            <NovoMockupDialog
              open={novoMockupOpen}
              onOpenChange={setNovoMockupOpen}
              onSuccess={carregarMockups}
            />
          </>
        )}
      </div>
    </div>
  );
}
