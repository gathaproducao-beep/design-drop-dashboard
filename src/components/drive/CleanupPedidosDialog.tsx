import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CleanupPedidosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: {
    days: number;
    cleanupFotoAprovacao: boolean;
    cleanupMoldeProducao: boolean;
  };
}

interface CleanupPreview {
  pedidosCount: number;
  filesCount: number;
  cutoffDate: string;
  pedidos: string[];
}

export default function CleanupPedidosDialog({
  open,
  onOpenChange,
  config,
}: CleanupPedidosDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [preview, setPreview] = useState<CleanupPreview | null>(null);

  const loadPreview = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-old-pedido-files", {
        body: {
          days: config.days,
          cleanupFotoAprovacao: config.cleanupFotoAprovacao,
          cleanupMoldeProducao: config.cleanupMoldeProducao,
          dryRun: true,
        },
      });

      if (error) throw error;

      setPreview({
        pedidosCount: data.summary.pedidosCount,
        filesCount: data.summary.filesCount,
        cutoffDate: data.summary.cutoffDate,
        pedidos: data.pedidos || [],
      });
    } catch (error: any) {
      console.error("Erro ao carregar preview:", error);
      toast({
        title: "Erro ao carregar preview",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeCleanup = async () => {
    setExecuting(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-old-pedido-files", {
        body: {
          days: config.days,
          cleanupFotoAprovacao: config.cleanupFotoAprovacao,
          cleanupMoldeProducao: config.cleanupMoldeProducao,
          dryRun: false,
        },
      });

      if (error) throw error;

      toast({
        title: "Limpeza concluída!",
        description: `${data.summary.filesDeleted} arquivos removidos de ${data.summary.pedidosUpdated} pedidos`,
      });

      onOpenChange(false);
      setPreview(null);
    } catch (error: any) {
      console.error("Erro na limpeza:", error);
      toast({
        title: "Erro na limpeza",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setExecuting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      loadPreview();
    } else {
      setPreview(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Limpar Arquivos de Pedidos Antigos
          </DialogTitle>
          <DialogDescription>
            Esta ação irá remover permanentemente os arquivos selecionados do Storage.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Configuração atual */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">Pedidos com mais de {config.days} dias</Badge>
            {config.cleanupFotoAprovacao && <Badge>Fotos de Aprovação</Badge>}
            {config.cleanupMoldeProducao && <Badge>Moldes de Produção</Badge>}
          </div>

          {/* Preview */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Calculando...</span>
            </div>
          ) : preview ? (
            <div className="space-y-4">
              {preview.filesCount > 0 ? (
                <>
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Pedidos afetados:</span>
                      <span className="font-medium">{preview.pedidosCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Arquivos a remover:</span>
                      <span className="font-medium text-destructive">{preview.filesCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Data limite:</span>
                      <span className="font-medium">{preview.cutoffDate}</span>
                    </div>
                  </div>

                  {preview.pedidos.length > 0 && (
                    <div className="max-h-32 overflow-y-auto rounded border p-2">
                      <p className="text-xs text-muted-foreground mb-1">Pedidos:</p>
                      <div className="flex flex-wrap gap-1">
                        {preview.pedidos.slice(0, 20).map((p) => (
                          <Badge key={p} variant="secondary" className="text-xs">
                            {p}
                          </Badge>
                        ))}
                        {preview.pedidos.length > 20 && (
                          <Badge variant="outline" className="text-xs">
                            +{preview.pedidos.length - 20} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-start gap-2 rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-3">
                    <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-700">Atenção</p>
                      <p className="text-yellow-600">
                        As fotos do cliente serão mantidas. Se precisar, você pode regenerar os mockups.
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum arquivo encontrado para limpeza.</p>
                  <p className="text-sm mt-1">
                    Não há pedidos com mais de {config.days} dias que tenham os arquivos selecionados.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={executeCleanup}
            disabled={loading || executing || !preview || preview.filesCount === 0}
          >
            {executing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Limpando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Limpar {preview?.filesCount || 0} Arquivos
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
