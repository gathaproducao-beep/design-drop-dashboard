import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RefreshCw, AlertCircle, Play, X, RotateCcw, ImageIcon, ChevronLeft, ChevronRight, Trash2, Filter, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ErrorDialog } from "./ErrorDialog";
import { useState, useMemo } from "react";
import { toast } from "sonner";
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

const PAGE_SIZE = 50;

interface QueueItem {
  id: string;
  phone: string;
  message: string;
  status: string;
  attempts: number;
  max_attempts: number;
  error_message: string | null;
  created_at: string;
  sent_at: string | null;
  pedido_id: string | null;
  media_url: string | null;
  media_type: string | null;
  caption: string | null;
  instance_id: string | null;
  pedidos: {
    numero_pedido: string;
    nome_cliente: string;
  } | null;
  whatsapp_instances: {
    nome: string;
    evolution_instance: string;
  } | null;
}

interface Filters {
  status: string;
  data: string;
  pedido: string;
  telefone: string;
}

export function FilaWhatsappTable() {
  const [selectedError, setSelectedError] = useState<{ pedido: string; error: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({
    status: "all",
    data: "",
    pedido: "",
    telefone: "",
  });

  // Build filter conditions for count query
  const buildFilterQuery = (query: any) => {
    if (filters.status && filters.status !== "all") {
      query = query.eq("status", filters.status);
    }
    if (filters.data) {
      const startDate = new Date(filters.data);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.data);
      endDate.setHours(23, 59, 59, 999);
      query = query.gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
    }
    if (filters.telefone) {
      query = query.ilike("phone", `%${filters.telefone.replace(/\D/g, "")}%`);
    }
    return query;
  };

  // Query para contar total de registros com filtros
  const { data: totalCount, refetch: refetchCount } = useQuery({
    queryKey: ["whatsapp-queue-count", filters],
    queryFn: async () => {
      let query = supabase
        .from("whatsapp_queue")
        .select("*", { count: "exact", head: true });

      query = buildFilterQuery(query);

      const { count, error } = await query;
      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  const { data: queueItems, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-queue", currentPage, filters],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("whatsapp_queue")
        .select(`
          *,
          pedidos (
            numero_pedido,
            nome_cliente
          ),
          whatsapp_instances (
            nome,
            evolution_instance
          )
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filters.status && filters.status !== "all") {
        query = query.eq("status", filters.status);
      }
      if (filters.data) {
        const startDate = new Date(filters.data);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.data);
        endDate.setHours(23, 59, 59, 999);
        query = query.gte("created_at", startDate.toISOString()).lte("created_at", endDate.toISOString());
      }
      if (filters.telefone) {
        query = query.ilike("phone", `%${filters.telefone.replace(/\D/g, "")}%`);
      }

      query = query.range(from, to);

      const { data, error } = await query;
      if (error) throw error;
      
      // Filter by pedido on the client side (since we need to filter on related table)
      let filteredData = data as QueueItem[];
      if (filters.pedido) {
        filteredData = filteredData.filter(item => 
          item.pedidos?.numero_pedido?.toLowerCase().includes(filters.pedido.toLowerCase())
        );
      }
      
      return filteredData;
    },
    refetchInterval: 30000,
  });

  const handleProcessQueue = async () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('process-whatsapp-queue');
      if (error) throw error;
      
      toast.success("Fila processada com sucesso!");
      await new Promise(resolve => setTimeout(resolve, 2000));
      refetch();
      refetchCount();
    } catch (error) {
      console.error("Erro ao processar fila:", error);
      toast.error("Erro ao processar fila");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('whatsapp_queue')
        .update({ 
          status: 'cancelled', 
          cancelled_at: new Date().toISOString() 
        })
        .in('id', selectedIds);
      
      if (error) throw error;
      toast.success(`${selectedIds.length} mensagens canceladas`);
      setSelectedIds([]);
      refetch();
      refetchCount();
    } catch (error) {
      console.error("Erro ao cancelar mensagens:", error);
      toast.error("Erro ao cancelar mensagens");
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    try {
      const { error } = await supabase
        .from('whatsapp_queue')
        .delete()
        .in('id', selectedIds);
      
      if (error) throw error;
      toast.success(`${selectedIds.length} mensagens excluídas`);
      setSelectedIds([]);
      setShowDeleteDialog(false);
      refetch();
      refetchCount();
    } catch (error) {
      console.error("Erro ao excluir mensagens:", error);
      toast.error("Erro ao excluir mensagens");
    }
  };

  const handleReprocessSelected = async () => {
    if (selectedIds.length === 0) return;
    
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from('whatsapp_queue')
        .update({ 
          status: 'pending', 
          attempts: 0, 
          error_message: null 
        })
        .in('id', selectedIds);
      
      if (error) throw error;
      toast.success(`${selectedIds.length} mensagens marcadas para reprocessamento`);
      setSelectedIds([]);
      
      const { error: processError } = await supabase.functions.invoke('process-whatsapp-queue');
      if (processError) {
        console.error("Erro ao processar fila:", processError);
        toast.error("Erro ao processar fila automaticamente");
      } else {
        toast.success("Fila processada!");
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      refetch();
      refetchCount();
    } catch (error) {
      console.error("Erro ao reprocessar mensagens:", error);
      toast.error("Erro ao reprocessar mensagens");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === queueItems?.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(queueItems?.map(item => item.id) || []);
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setSelectedIds([]);
    }
  };

  const clearFilters = () => {
    setFilters({ status: "all", data: "", pedido: "", telefone: "" });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.status !== "all" || filters.data || filters.pedido || filters.telefone;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      processing: { variant: "outline", label: "Processando" },
      sent: { variant: "default", label: "Enviada" },
      failed: { variant: "destructive", label: "Falhou" },
      cancelled: { variant: "outline", label: "Cancelado" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length === 13) {
      return `+${cleaned.slice(0, 2)} (${cleaned.slice(2, 4)}) ${cleaned.slice(4, 9)}-${cleaned.slice(9)}`;
    }
    return phone;
  };

  const truncateMessage = (message: string, maxLength = 40) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  const formatDateShort = (dateStr: string) => {
    return format(new Date(dateStr), "dd/MM HH:mm", { locale: ptBR });
  };

  // Componente de paginação reutilizável
  const PaginationControls = () => (
    totalPages > 1 ? (
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Página {currentPage} de {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
          <div className="flex gap-1">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <Button
                  key={pageNum}
                  variant={pageNum === currentPage ? "default" : "outline"}
                  size="sm"
                  className="w-8"
                  onClick={() => goToPage(pageNum)}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Próxima
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    ) : null
  );

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando fila...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header com contagem e ações */}
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div className="text-sm text-muted-foreground">
          {totalCount || 0} mensagens na fila
          {selectedIds.length > 0 && (
            <span className="ml-2 font-semibold">
              ({selectedIds.length} selecionadas)
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {hasActiveFilters && <Badge variant="destructive" className="ml-2 h-5 w-5 p-0 text-xs">{Object.values(filters).filter(v => v && v !== "all").length}</Badge>}
          </Button>
          {selectedIds.length > 0 && (
            <>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCancelSelected}
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleReprocessSelected}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reprocessar
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </>
          )}
          <Button 
            variant="default" 
            size="sm" 
            onClick={handleProcessQueue}
            disabled={isProcessing}
          >
            <Play className="h-4 w-4 mr-2" />
            {isProcessing ? "Processando..." : "Processar Fila"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => { refetch(); refetchCount(); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Filtros */}
      {showFilters && (
        <div className="flex flex-wrap gap-3 p-4 bg-muted/50 rounded-lg border">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={filters.status}
              onValueChange={(value) => {
                setFilters(prev => ({ ...prev, status: value }));
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="sent">Enviada</SelectItem>
                <SelectItem value="failed">Falhou</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Data</label>
            <Input
              type="date"
              value={filters.data}
              onChange={(e) => {
                setFilters(prev => ({ ...prev, data: e.target.value }));
                setCurrentPage(1);
              }}
              className="w-[150px] h-9"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Pedido</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Nº pedido..."
                value={filters.pedido}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, pedido: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-[140px] h-9 pl-8"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">Telefone</label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Telefone..."
                value={filters.telefone}
                onChange={(e) => {
                  setFilters(prev => ({ ...prev, telefone: e.target.value }));
                  setCurrentPage(1);
                }}
                className="w-[140px] h-9 pl-8"
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Paginação Superior */}
      <PaginationControls />

      <div className="border rounded-lg overflow-x-auto">
        <Table>
          <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === queueItems?.length && queueItems?.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-20">Pedido</TableHead>
                <TableHead className="w-28">Cliente</TableHead>
                <TableHead className="w-36">Telefone</TableHead>
                <TableHead className="w-16">Tipo</TableHead>
                <TableHead className="min-w-[120px] max-w-[180px]">Mensagem</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Enviado via</TableHead>
                <TableHead className="w-16">Tent.</TableHead>
                <TableHead className="w-24">Criado</TableHead>
                <TableHead className="w-24">Enviado</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {queueItems && queueItems.length > 0 ? (
              queueItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="p-2">
                    <Checkbox
                      checked={selectedIds.includes(item.id)}
                      onCheckedChange={() => toggleSelectItem(item.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium p-2 text-sm">
                    {item.pedidos?.numero_pedido || "-"}
                  </TableCell>
                  <TableCell className="p-2 text-sm truncate max-w-[112px]" title={item.pedidos?.nome_cliente || ""}>
                    {item.pedidos?.nome_cliente || "-"}
                  </TableCell>
                  <TableCell className="font-mono text-xs p-2">
                    {formatPhone(item.phone)}
                  </TableCell>
                  <TableCell className="p-2">
                    {item.media_type ? (
                      <Badge variant="outline" className="gap-1 text-xs px-1">
                        <ImageIcon className="h-3 w-3" />
                        {item.media_type === 'image' ? 'Img' : item.media_type}
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs px-1">Txt</Badge>
                    )}
                  </TableCell>
                  <TableCell className="p-2 max-w-[180px]">
                    {item.media_url ? (
                      <div className="space-y-0.5">
                        <span className="text-xs text-muted-foreground block truncate">
                          {truncateMessage(item.caption || item.message, 30)}
                        </span>
                        <a 
                          href={item.media_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <ImageIcon className="h-3 w-3" />
                          Ver
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground truncate block" title={item.message}>
                        {truncateMessage(item.message, 30)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="p-2">{getStatusBadge(item.status)}</TableCell>
                  <TableCell className="p-2">
                    {item.whatsapp_instances ? (
                      <span className="text-xs font-medium truncate block max-w-[100px]" title={item.whatsapp_instances.evolution_instance}>
                        {item.whatsapp_instances.nome}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="p-2">
                    <span className={`text-xs ${item.attempts >= item.max_attempts ? "text-destructive font-semibold" : ""}`}>
                      {item.attempts}/{item.max_attempts}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs p-2 whitespace-nowrap">
                    {formatDateShort(item.created_at)}
                  </TableCell>
                  <TableCell className="text-xs p-2 whitespace-nowrap">
                    {item.sent_at ? formatDateShort(item.sent_at) : "-"}
                  </TableCell>
                  <TableCell className="p-2">
                    {item.error_message && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() =>
                          setSelectedError({
                            pedido: item.pedidos?.numero_pedido || item.phone,
                            error: item.error_message!,
                          })
                        }
                      >
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                  {hasActiveFilters ? "Nenhuma mensagem encontrada com os filtros aplicados" : "Nenhuma mensagem na fila"}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação Inferior */}
      <PaginationControls />

      {selectedError && (
        <ErrorDialog
          open={!!selectedError}
          onOpenChange={(open) => !open && setSelectedError(null)}
          pedido={selectedError.pedido}
          errorMessage={selectedError.error}
        />
      )}

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir {selectedIds.length} mensagem(ns)? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteSelected} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}