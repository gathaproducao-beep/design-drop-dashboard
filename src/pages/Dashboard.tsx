import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter, Trash2, Upload, FileSpreadsheet, Download, Archive, Edit, Loader2, Cloud, MessageSquare } from "lucide-react";
import { AtualizarLoteDialog } from "@/components/pedidos/AtualizarLoteDialog";
import { toast } from "sonner";
import { PedidosTable } from "@/components/pedidos/PedidosTable";
import { NovoPedidoDialog } from "@/components/pedidos/NovoPedidoDialog";
import { ImportarPedidosDialog } from "@/components/pedidos/ImportarPedidosDialog";
import { ImportarFotosDialog } from "@/components/pedidos/ImportarFotosDialog";
import { Navigation } from "@/components/Navigation";
import { StorageCleanupDialog } from "@/components/drive/StorageCleanupDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { PermissionGate } from "@/components/PermissionGate";
import { getDataBrasilia } from "@/lib/utils";
import { useMockupQueue } from "@/hooks/useMockupQueue";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  const [gerarFotoAuto, setGerarFotoAuto] = useState(true);
  const [importarFotosOpen, setImportarFotosOpen] = useState(false);
  const [downloadDialogOpen, setDownloadDialogOpen] = useState(false);
  const [tipoDownload, setTipoDownload] = useState<'aprovacao' | 'molde'>('molde');
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [itensPorPagina, setItensPorPagina] = useState(50);
  const [filterArquivado, setFilterArquivado] = useState<string>("ativos");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [atualizarLoteOpen, setAtualizarLoteOpen] = useState(false);
  const [salvandoDrive, setSalvandoDrive] = useState(false);
  const [enviandoMensagens, setEnviandoMensagens] = useState(false);

  // Hook para fila de geração de mockups
  const mockupQueue = useMockupQueue(() => carregarPedidos());

  useEffect(() => {
    carregarPedidos();
  }, [filterArquivado]);

  useEffect(() => {
    setPaginaAtual(1);
  }, [searchTerm, filterMensagem, filterLayout, filterDataInicio, filterDataFim, filterArquivado]);

  const carregarPedidos = async () => {
    try {
      let query = supabase
        .from("pedidos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (filterArquivado === "ativos") {
        query = query.eq("arquivado", false);
      } else if (filterArquivado === "arquivados") {
        query = query.eq("arquivado", true);
      }
      
      const { data, error } = await query;

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    } finally {
      setLoading(false);
    }
  };

  const handleExcluirSelecionados = () => {
    if (selectedIds.size === 0) return;
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    try {
      const pedidoIds = Array.from(selectedIds);
      
      // Buscar dados dos pedidos para deletar arquivos do storage
      const { data: pedidosParaDeletar, error: fetchError } = await supabase
        .from("pedidos")
        .select("*")
        .in("id", pedidoIds);
      
      if (fetchError) throw fetchError;
      
      // Deletar arquivos do storage para cada pedido
      if (pedidosParaDeletar && pedidosParaDeletar.length > 0) {
        const { deletePedidoStorageFiles } = await import("@/lib/storage-utils");
        
        for (const pedido of pedidosParaDeletar) {
          try {
            await deletePedidoStorageFiles(pedido);
          } catch (storageError) {
            console.error(`Erro ao deletar arquivos do pedido ${pedido.numero_pedido}:`, storageError);
            // Continua mesmo se houver erro no storage
          }
        }
      }
      
      // Excluir mensagens da fila do WhatsApp relacionadas aos pedidos
      await supabase
        .from("whatsapp_queue")
        .delete()
        .in("pedido_id", pedidoIds);
      
      // Excluir os pedidos do banco
      const { error } = await supabase
        .from("pedidos")
        .delete()
        .in("id", pedidoIds);

      if (error) throw error;
      
      toast.success(`${selectedIds.size} pedido(s) e seus arquivos excluídos`);
      setSelectedIds(new Set());
      setDeleteDialogOpen(false);
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir pedidos");
    }
  };

  const handleArquivarSelecionados = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const pedidoIds = Array.from(selectedIds);
      
      const { error } = await supabase
        .from("pedidos")
        .update({ arquivado: true })
        .in("id", pedidoIds);

      if (error) throw error;
      
      toast.success(`${selectedIds.size} pedido(s) arquivado(s)`);
      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao arquivar:", error);
      toast.error("Erro ao arquivar pedidos");
    }
  };

  const handleDesarquivarSelecionados = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      const pedidoIds = Array.from(selectedIds);
      
      const { error } = await supabase
        .from("pedidos")
        .update({ arquivado: false })
        .in("id", pedidoIds);

      if (error) throw error;
      
      toast.success(`${selectedIds.size} pedido(s) restaurado(s)`);
      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao restaurar:", error);
      toast.error("Erro ao restaurar pedidos");
    }
  };

  const handleDownloadClick = () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um pedido");
      return;
    }
    setDownloadDialogOpen(true);
  };

  const handleConfirmarDownload = async () => {
    setDownloadDialogOpen(false);
    
    const campo = tipoDownload === 'aprovacao' ? 'foto_aprovacao' : 'molde_producao';
    const label = tipoDownload === 'aprovacao' ? 'foto(s) de aprovação' : 'molde(s)';
    
    const pedidosComArquivos = pedidos.filter(p => 
      selectedIds.has(p.id) && p[campo]
    );
    
    if (pedidosComArquivos.length === 0) {
      toast.error(`Nenhum ${label} encontrado nos pedidos selecionados`);
      return;
    }
    
    const toastId = toast.loading(`Baixando ${label}...`);
    
    try {
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      let totalImagens = 0;
      
      for (const pedido of pedidosComArquivos) {
        try {
          // Normalizar para array (compatibilidade com dados antigos)
          const arquivos = Array.isArray(pedido[campo]) 
            ? pedido[campo] 
            : [pedido[campo]];
          
          // Baixar cada arquivo
          for (let i = 0; i < arquivos.length; i++) {
            const arquivoUrl = arquivos[i];
            const response = await fetch(arquivoUrl);
            const blob = await response.blob();
            
            // Nome: NumPedido_CodigoProduto_1.png, NumPedido_CodigoProduto_2.png, etc
            const sufixo = arquivos.length > 1 ? `_${i + 1}` : '';
            const nomeArquivo = `${pedido.numero_pedido}_${pedido.codigo_produto}${sufixo}.png`;
            
            zip.file(nomeArquivo, blob);
            totalImagens++;
          }
        } catch (error) {
          console.error(`Erro ao baixar arquivo do pedido ${pedido.numero_pedido}:`, error);
        }
      }
      
      // Gerar o ZIP
      const zipBlob = await zip.generateAsync({ 
        type: 'blob',
        compression: "STORE"
      });
      
      // Download
      const url = URL.createObjectURL(zipBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${tipoDownload === 'aprovacao' ? 'fotos_aprovacao' : 'moldes'}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success(`${totalImagens} ${label} baixado(s)`, { id: toastId });
    } catch (error) {
      console.error("Erro ao baixar arquivos:", error);
      toast.error(`Erro ao baixar ${label}`, { id: toastId });
    }
  };

  const handleAdicionarLinhas = async () => {
    try {
      const novaLinha = {
        numero_pedido: `NOVO-${Date.now()}`,
        nome_cliente: "",
        codigo_produto: "",
        data_pedido: getDataBrasilia(),
      };

      const { error } = await supabase.from("pedidos").insert([novaLinha]);
      
      if (error) throw error;
      
      toast.success("Linha adicionada");
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao adicionar linha:", error);
      toast.error("Erro ao adicionar linha");
    }
  };

  const handleImportarFotos = () => {
    setImportarFotosOpen(true);
  };

  const handleImportarPedidos = () => {
    setImportarPedidosOpen(true);
  };

  const handleAtualizarLote = async (campo: string, valor: string) => {
    const pedidoIds = Array.from(selectedIds);
    
    try {
      // Caso especial: reenviar mensagem
      if (campo === "mensagem_enviada" && valor === "reenviar") {
        const { processarEnvioPedido } = await import("@/lib/whatsapp");
        let enviados = 0;
        let erros = 0;
        
        for (const id of pedidoIds) {
          try {
            await processarEnvioPedido(id);
            enviados++;
          } catch (error) {
            console.error(`Erro ao processar pedido ${id}:`, error);
            erros++;
          }
        }
        
        if (erros > 0) {
          toast.warning(`${enviados} mensagem(ns) adicionada(s) à fila. ${erros} erro(s).`);
        } else {
          toast.success(`${enviados} mensagem(ns) adicionada(s) à fila`);
        }
        setSelectedIds(new Set());
        carregarPedidos();
        return;
      }
      
      // Atualização normal
      const { error } = await supabase
        .from("pedidos")
        .update({ [campo]: valor || null })
        .in("id", pedidoIds);
      
      if (error) throw error;
      
      toast.success(`${pedidoIds.length} pedido(s) atualizado(s)`);
      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao atualizar em lote:", error);
      toast.error("Erro ao atualizar pedidos");
      throw error;
    }
  };

  // Verificar se há instâncias WhatsApp ativas
  const verificarInstanciasAtivas = async (): Promise<boolean> => {
    const { data } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('is_active', true)
      .limit(1);
    return data && data.length > 0;
  };

  // Enviar mensagens em lote para os pedidos selecionados
  const handleEnviarMensagens = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um pedido");
      return;
    }

    setEnviandoMensagens(true);
    const toastId = toast.loading("Verificando configurações...");

    try {
      // Verificar se há instâncias ativas
      const temInstancia = await verificarInstanciasAtivas();
      if (!temInstancia) {
        toast.error("Configure ao menos uma instância WhatsApp ativa antes de enviar mensagens", { id: toastId });
        setEnviandoMensagens(false);
        return;
      }

      const { processarEnvioPedido } = await import("@/lib/whatsapp");
      const pedidoIds = Array.from(selectedIds);
      let enviados = 0;
      let erros = 0;

      toast.loading(`Adicionando ${pedidoIds.length} mensagem(ns) à fila...`, { id: toastId });

      for (const id of pedidoIds) {
        try {
          await processarEnvioPedido(id);
          enviados++;
        } catch (error) {
          console.error(`Erro ao processar pedido ${id}:`, error);
          erros++;
        }
      }

      if (erros > 0) {
        toast.warning(`${enviados} mensagem(ns) adicionada(s) à fila. ${erros} erro(s).`, { id: toastId });
      } else {
        toast.success(`${enviados} mensagem(ns) adicionada(s) à fila de envio`, { id: toastId });
      }

      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao enviar mensagens:", error);
      toast.error("Erro ao enviar mensagens", { id: toastId });
    } finally {
      setEnviandoMensagens(false);
    }
  };

  // Salvar no Drive em lote para os pedidos selecionados
  const handleSalvarDriveLote = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecione pelo menos um pedido");
      return;
    }

    const pedidosParaSalvar = pedidos.filter(p => 
      selectedIds.has(p.id) && 
      p.layout_aprovado === 'aprovado' &&
      p.foto_aprovacao?.length > 0
    );

    if (pedidosParaSalvar.length === 0) {
      toast.error("Nenhum pedido selecionado com layout aprovado e fotos de aprovação");
      return;
    }

    setSalvandoDrive(true);
    const toastId = toast.loading(`Salvando ${pedidosParaSalvar.length} pedido(s) no Drive...`);

    try {
      const { uploadPedidoToDriveByDate } = await import("@/lib/google-drive");
      let salvos = 0;
      let erros = 0;

      for (const pedido of pedidosParaSalvar) {
        try {
          const result = await uploadPedidoToDriveByDate(pedido, (msg) => console.log(msg));
          if (result.success) {
            salvos++;
          } else {
            erros++;
          }
        } catch (error) {
          console.error(`Erro ao salvar pedido ${pedido.numero_pedido}:`, error);
          erros++;
        }
      }

      if (erros > 0) {
        toast.warning(`${salvos} pedido(s) salvo(s) no Drive. ${erros} erro(s).`, { id: toastId });
      } else {
        toast.success(`${salvos} pedido(s) salvo(s) no Google Drive`, { id: toastId });
      }

      setSelectedIds(new Set());
      carregarPedidos();
    } catch (error) {
      console.error("Erro ao salvar no Drive:", error);
      toast.error("Erro ao salvar no Drive", { id: toastId });
    } finally {
      setSalvandoDrive(false);
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

    const matchDataInicio = 
      !filterDataInicio || new Date(pedido.data_pedido) >= new Date(filterDataInicio);
    
    const matchDataFim = 
      !filterDataFim || new Date(pedido.data_pedido) <= new Date(filterDataFim);

    return matchSearch && matchMensagem && matchLayout && matchDataInicio && matchDataFim;
  });

  const indexInicio = (paginaAtual - 1) * itensPorPagina;
  const indexFim = indexInicio + itensPorPagina;
  const pedidosPaginados = pedidosFiltrados.slice(indexInicio, indexFim);
  const totalPaginas = Math.ceil(pedidosFiltrados.length / itensPorPagina);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto px-6 py-6 max-w-[1800px]">
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground mb-1">
                Gestão de Pedidos
              </h1>
              <p className="text-muted-foreground text-sm">
                Gerencie pedidos e mockups de produção
              </p>
            </div>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setAtualizarLoteOpen(true)}
                    className="bg-purple-50 hover:bg-purple-100 border-purple-200 dark:bg-purple-950/30 dark:hover:bg-purple-900/40 dark:border-purple-800"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Atualizar em Lote ({selectedIds.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDownloadClick}
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:border-blue-800"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Baixar Arquivos ({selectedIds.size})
                  </Button>
                  {filterArquivado === "arquivados" ? (
                    <Button
                      variant="outline"
                      onClick={handleDesarquivarSelecionados}
                      className="bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-950/30 dark:hover:bg-green-900/40 dark:border-green-800"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Restaurar ({selectedIds.size})
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={handleArquivarSelecionados}
                      className="bg-amber-50 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/30 dark:hover:bg-amber-900/40 dark:border-amber-800"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Arquivar ({selectedIds.size})
                    </Button>
                  )}
                  <PermissionGate permission="deletar_pedido">
                    <Button
                      variant="destructive"
                      onClick={handleExcluirSelecionados}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Excluir selecionados ({selectedIds.size})
                    </Button>
                  </PermissionGate>
                  <Button
                    variant="outline"
                    onClick={handleEnviarMensagens}
                    disabled={enviandoMensagens}
                    className="bg-blue-50 hover:bg-blue-100 border-blue-200 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 dark:border-blue-800"
                  >
                    {enviandoMensagens ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <MessageSquare className="mr-2 h-4 w-4" />
                    )}
                    Enviar Mensagens ({selectedIds.size})
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSalvarDriveLote}
                    disabled={salvandoDrive}
                    className="bg-green-50 hover:bg-green-100 border-green-200 dark:bg-green-950/30 dark:hover:bg-green-900/40 dark:border-green-800"
                  >
                    {salvandoDrive ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Cloud className="mr-2 h-4 w-4" />
                    )}
                    Salvar no Drive ({selectedIds.size})
                  </Button>
                </>
              )}
              <PermissionGate permission="criar_pedido">
                <Button
                  onClick={() => setNovoPedidoOpen(true)}
                  className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Pedido
                </Button>
              </PermissionGate>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 p-3 bg-muted/30 rounded-lg border">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
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
              {/* Indicador de fila de mockups */}
              {(mockupQueue.isProcessing || mockupQueue.pendingCount > 0) && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-md border border-primary/20">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {mockupQueue.isProcessing 
                      ? `Gerando mockup${mockupQueue.pendingCount > 0 ? ` (+${mockupQueue.pendingCount} na fila)` : '...'}`
                      : `${mockupQueue.pendingCount} na fila`}
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <StorageCleanupDialog />
              <PermissionGate permission="importar_fotos">
                <Button
                  onClick={handleImportarFotos}
                  variant="outline"
                  size="sm"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Importar Fotos
                </Button>
              </PermissionGate>
              <PermissionGate permission="importar_pedidos">
                <Button
                  onClick={handleImportarPedidos}
                  variant="outline"
                  size="sm"
                >
                  <FileSpreadsheet className="mr-2 h-4 w-4" />
                  Importar Pedidos
                </Button>
              </PermissionGate>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-3">
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
                className="w-[150px]"
                placeholder="Data início"
              />
              <Input
                type="date"
                value={filterDataFim}
                onChange={(e) => setFilterDataFim(e.target.value)}
                className="w-[150px]"
                placeholder="Data fim"
              />
              
              <Select value={filterMensagem} onValueChange={setFilterMensagem}>
                <SelectTrigger className="w-[160px]">
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
                <SelectTrigger className="w-[160px]">
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

              <Select value={filterArquivado} onValueChange={setFilterArquivado}>
                <SelectTrigger className="w-[160px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativos">Pedidos Ativos</SelectItem>
                  <SelectItem value="arquivados">Arquivados</SelectItem>
                  <SelectItem value="todos">Todos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4 gap-4 bg-muted/30 p-4 rounded-lg border">
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Exibindo {pedidosFiltrados.length > 0 ? indexInicio + 1 : 0}-{Math.min(indexFim, pedidosFiltrados.length)} de {pedidosFiltrados.length} pedidos
            </span>
            <Select 
              value={itensPorPagina.toString()} 
              onValueChange={(v) => {
                setItensPorPagina(Number(v));
                setPaginaAtual(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30">30 por página</SelectItem>
                <SelectItem value="50">50 por página</SelectItem>
                <SelectItem value="100">100 por página</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(p => Math.max(1, p - 1))}
              disabled={paginaAtual === 1}
            >
              Anterior
            </Button>
            <span className="text-sm font-medium">
              Página {paginaAtual} de {totalPaginas || 1}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPaginaAtual(p => Math.min(totalPaginas, p + 1))}
              disabled={paginaAtual === totalPaginas || totalPaginas === 0}
            >
              Próxima
            </Button>
          </div>
        </div>

        <PedidosTable
          pedidos={pedidosPaginados}
          loading={loading}
          onRefresh={carregarPedidos}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          gerarFotoAuto={gerarFotoAuto}
          mockupQueue={mockupQueue}
        />

        <div className="mt-4">
          <Button
            onClick={handleAdicionarLinhas}
            variant="outline"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar linha
          </Button>
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
        
        <ImportarFotosDialog
          open={importarFotosOpen}
          onOpenChange={setImportarFotosOpen}
          onSuccess={carregarPedidos}
          gerarFotoAuto={gerarFotoAuto}
        />

        <Dialog open={downloadDialogOpen} onOpenChange={setDownloadDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Selecionar Tipo de Download</DialogTitle>
              <DialogDescription>
                Escolha qual tipo de arquivo deseja baixar dos {selectedIds.size} pedidos selecionados
              </DialogDescription>
            </DialogHeader>
            
            <RadioGroup value={tipoDownload} onValueChange={(value) => setTipoDownload(value as 'aprovacao' | 'molde')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="aprovacao" id="aprovacao" />
                <Label htmlFor="aprovacao" className="cursor-pointer">
                  Foto de Aprovação
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="molde" id="molde" />
                <Label htmlFor="molde" className="cursor-pointer">
                  Molde de Produção
                </Label>
              </div>
            </RadioGroup>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDownloadDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleConfirmarDownload}>
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir {selectedIds.size} pedido(s)?
                Esta ação não pode ser desfeita e removerá permanentemente os registros do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AtualizarLoteDialog
          open={atualizarLoteOpen}
          onOpenChange={setAtualizarLoteOpen}
          selectedCount={selectedIds.size}
          onConfirm={handleAtualizarLote}
        />
      </div>
    </div>
  );
}
