import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Trash2, Upload, FileSpreadsheet, Download } from "lucide-react";
import { toast } from "sonner";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { ImportarPedidosDialog } from "@/components/pedidos/ImportarPedidosDialog";
import { Navigation } from "@/components/Navigation";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Dashboard() {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterMensagem, setFilterMensagem] = useState<string>("todos");
  const [filterLayout, setFilterLayout] = useState<string>("todos");
  const [filterDataInicio, setFilterDataInicio] = useState("");
  const [filterDataFim, setFilterDataFim] = useState("");
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);
  const [importarPedidosOpen, setImportarPedidosOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [gerarFotoAuto, setGerarFotoAuto] = useState(false);

  useEffect(() => {
    carregarPedidos();
  }, []);

  const carregarPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirSelecionados = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const { error } = await supabase
        .from("pedidos")
        .delete()
        .in("id", Array.from(selectedIds));

      if (error) throw error;
      
      toast.success(`${selectedIds.size} pedido(s) excluído(s)`);
      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir pedidos");
    }
  };

  const handleDownloadMoldes = async () => {
    // Filtrar apenas pedidos selecionados que têm molde_producao
    const pedidosComMolde = pedidos.filter(p => 
      selectedIds.has(p.id) && p.molde_producao
    );
    
    if (pedidosComMolde.length === 0) {
      toast.error("Nenhum molde encontrado nos pedidos selecionados");
      return;
    }
    
    const toastId = toast.loading(`Baixando ${pedidosComMolde.length} molde(s)...`);
    
    try {
      // Importar JSZip dinamicamente
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      // Para cada pedido, fazer fetch da imagem e adicionar ao ZIP
      for (const pedido of pedidosComMolde) {
        try {
          const response = await fetch(pedido.molde_producao);
          const blob = await response.blob();
          
          // Nome do arquivo: NumPedido_CodigoProduto.png
          const nomeArquivo = `${pedido.numero_pedido}_${pedido.codigo_produto}.png`;
          zip.file(nomeArquivo, blob);
        } catch (error) {
          console.error(`Erro ao baixar molde ${pedido.numero_pedido}:`, error);
        }
      }
      
      // Gerar o ZIP sem compressão para manter qualidade máxima
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "STORE"
      });
      
      // Criar link de download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `moldes_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${pedidosComMolde.length} molde(s) baixado(s)`, { id: toastId });
    } catch (error) {
      console.error("Erro ao gerar ZIP:", error);
      toast.error("Erro ao baixar moldes", { id: toastId });
    }
  };

  const handleAdicionarLinhas = async () => {
    const numLinhas = 5; // Criar 5 linhas por padrão
    try {
      const novasLinhas = Array.from({ length: numLinhas }, (_, i) => ({
        numero_pedido: `NOVO-${Date.now()}-${i}`,
        nome_cliente: "",
        codigo_produto: "",
        data_pedido: new Date().toISOString().split('T')[0],
      }));

      const { error } = await supabase.from("pedidos").insert(novasLinhas);
      
      if (error) throw error;
      
      toast.success(`${numLinhas} linha(s) adicionada(s)`);
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao adicionar linhas:", error);
      toast.error("Erro ao adicionar linhas");
    }
  };

  const handleImportarFotos = () => {
    // TODO: Implementar importação de fotos
    toast.info("Funcionalidade em desenvolvimento");
  };

  const handleImportarPedidos = () => {
    setImportarPedidosOpen(true);
  };

  const pedidosFiltrados = pedidos.filter((pedido) => {
    const matchSearch =
      !searchTerm ||
      pedido.numero_pedido?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.nome_cliente?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pedido.codigo_produto?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchMensagem =
      filterMensagem === "todos" || pedido.mensagem_enviada === filterMensagem;

    const matchLayout =
      filterLayout === "todos" || pedido.layout_aprovado === filterLayout;

    const matchDataInicio = 
      !filterDataInicio || new Date(pedido.data_pedido) >= new Date(filterDataInicio);
    
    const matchDataFim = 
      !filterDataFim || new Date(pedido.data_pedido) <= new Date(filterDataFim);

    return matchSearch && matchMensagem && matchLayout && matchDataInicio && matchDataFim;
  });

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Gestão de Pedidos
              </h1>
              <p className="text-muted-foreground">
                Gerencie pedidos e mockups de produção
              </p>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDownloadMoldes}
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Moldes ({
                      pedidos.filter(p => selectedIds.has(p.id) && p.molde_producao).length
                    })
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleExcluirSelecionados}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir selecionados ({selectedIds.size})
                  </Button>
                </>
              )}
              <Button
                onClick={() => setNovoPedidoOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Pedido
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 p-4 bg-muted/30 rounded-lg border">
            <Checkbox
              id="gerar-auto"
              checked={gerarFotoAuto}
              onCheckedChange={(checked) => setGerarFotoAuto(checked as boolean)}
            />
            <label
              htmlFor="gerar-auto"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Gerar foto aprovação automaticamente
            </label>
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por número, cliente ou produto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2 flex-wrap">
              <Input
                type="date"
                value={filterDataInicio}
                onChange={(e) => setFilterDataInicio(e.target.value)}
                className="w-[160px]"
                placeholder="Data início"
              />
              <Input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="w-[160px]"
                placeholder="Data fim"
              />
              
              <Select value={filterMensagem} onValueChange={setFilterMensagem}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Mensagem" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas Mensagens</SelectItem>
                  <SelectItem value="enviada">Enviada</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterLayout} onValueChange={setFilterLayout}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Layout" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Layouts</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="reprovado">Reprovado</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <PedidosTable
          pedidos={pedidosFiltrados}
          loading={loading}
          onRefresh={carregarPedidos}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          gerarFotoAuto={gerarFotoAuto}
        />

        <div className="mt-6 flex gap-4 justify-between items-center">
          <Button
            onClick={handleAdicionarLinhas}
            variant="outline"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar linhas
          </Button>

          <div className="flex gap-2">
            <Button
              onClick={handleImportarFotos}
              variant="outline"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar Fotos
            </Button>
            <Button
              onClick={handleImportarPedidos}
              variant="outline"
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Importar Pedidos
            </Button>
          </div>
        </div>

        <NovoPedidoDialog
          open={novoPedidoOpen}
          onOpenChange={setNovoPedidoOpen}
          onSuccess={carregarPedidos}
        />
        
        <ImportarPedidosDialog
          open={importarPedidosOpen}
          onOpenChange={setImportarPedidosOpen}
          onSuccess={carregarPedidos}
        />
      </div>
    </div>
  );
}
