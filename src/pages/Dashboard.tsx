import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";
import { toast } from "sonner";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { Navigation } from "@/components/Navigation";
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
  const [novoPedidoOpen, setNovoPedidoOpen] = useState(false);

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

    return matchSearch && matchMensagem && matchLayout;
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
            <Button
              onClick={() => setNovoPedidoOpen(true)}
              className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
            >
              <Plus className="mr-2 h-4 w-4" />
              Novo Pedido
            </Button>
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

            <div className="flex gap-2">
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
        />

        <NovoPedidoDialog
          open={novoPedidoOpen}
          onOpenChange={setNovoPedidoOpen}
          onSuccess={carregarPedidos}
        />
      </div>
    </div>
  );
}
