import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RefreshCw, AlertCircle, Play, X, RotateCcw, ImageIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ErrorDialog } from "./ErrorDialog";
import { useState } from "react";
import { toast } from "sonner";

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

export function FilaWhatsappTable() {
  const [selectedError, setSelectedError] = useState<{ pedido: string; error: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Query para contar total de registros
  const { data: totalCount } = useQuery({
    queryKey: ["whatsapp-queue-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("whatsapp_queue")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count || 0;
    },
    refetchInterval: 30000,
  });

  const totalPages = Math.ceil((totalCount || 0) / PAGE_SIZE);

  const { data: queueItems, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-queue", currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
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
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data as QueueItem[];
    },
    refetchInterval: 30000,
  });

  const handleProcessQueue = async () => {
    if (isProcessing) return; // Prevenção extra contra cliques múltiplos
    
    setIsProcessing(true);
    try {
      const { error } = await supabase.functions.invoke('process-whatsapp-queue');
      if (error) throw error;
      
      toast.success("Fila processada com sucesso!");
      
      // Aguardar 2 segundos antes de permitir novo processamento
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      refetch();
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
    } catch (error) {
      console.error("Erro ao cancelar mensagens:", error);
      toast.error("Erro ao cancelar mensagens");
    }
  };

  const handleReprocessSelected = async () => {
    if (selectedIds.length === 0) return;
    
    setIsProcessing(true);
    try {
      // 1. Marcar mensagens como pending
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
      
      // 2. Processar a fila automaticamente
      const { error: processError } = await supabase.functions.invoke('process-whatsapp-queue');
      if (processError) {
        console.error("Erro ao processar fila:", processError);
        toast.error("Erro ao processar fila automaticamente");
      } else {
        toast.success("Fila processada!");
      }
      
      // 3. Aguardar um pouco e atualizar
      await new Promise(resolve => setTimeout(resolve, 2000));
      refetch();
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

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando fila...</div>;
  }

  return (
    <div className="space-y-4">
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
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>
      </div>

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
                  Nenhuma mensagem na fila
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
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
      )}

      {selectedError && (
        <ErrorDialog
          open={!!selectedError}
          onOpenChange={(open) => !open && setSelectedError(null)}
          pedido={selectedError.pedido}
          errorMessage={selectedError.error}
        />
      )}
    </div>
  );
}