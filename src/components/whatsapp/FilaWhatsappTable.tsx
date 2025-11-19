import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ErrorDialog } from "./ErrorDialog";
import { useState } from "react";

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
  pedidos: {
    numero_pedido: string;
    nome_cliente: string;
  } | null;
}

export function FilaWhatsappTable() {
  const [selectedError, setSelectedError] = useState<{ pedido: string; error: string } | null>(null);

  const { data: queueItems, isLoading, refetch } = useQuery({
    queryKey: ["whatsapp-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_queue")
        .select(`
          *,
          pedidos (
            numero_pedido,
            nome_cliente
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as QueueItem[];
    },
    refetchInterval: 30000, // Auto-refresh a cada 30s
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
      pending: { variant: "secondary", label: "Pendente" },
      processing: { variant: "outline", label: "Processando" },
      sent: { variant: "default", label: "Enviada" },
      failed: { variant: "destructive", label: "Falhou" },
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

  const truncateMessage = (message: string, maxLength = 50) => {
    if (message.length <= maxLength) return message;
    return message.substring(0, maxLength) + "...";
  };

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando fila...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="text-sm text-muted-foreground">
          {queueItems?.length || 0} mensagens na fila
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Atualizar
        </Button>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pedido</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Mensagem</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tentativas</TableHead>
              <TableHead>Criado em</TableHead>
              <TableHead>Enviado em</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queueItems && queueItems.length > 0 ? (
              queueItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">
                    {item.pedidos?.numero_pedido || "-"}
                  </TableCell>
                  <TableCell>{item.pedidos?.nome_cliente || "-"}</TableCell>
                  <TableCell className="font-mono text-sm">
                    {formatPhone(item.phone)}
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <span className="text-sm text-muted-foreground">
                      {truncateMessage(item.message)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(item.status)}</TableCell>
                  <TableCell>
                    <span className={item.attempts >= item.max_attempts ? "text-destructive font-semibold" : ""}>
                      {item.attempts}/{item.max_attempts}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(item.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {item.sent_at
                      ? format(new Date(item.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {item.error_message && (
                      <Button
                        variant="ghost"
                        size="sm"
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
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhuma mensagem na fila
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
