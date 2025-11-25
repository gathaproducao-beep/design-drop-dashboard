import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertCircle, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export function StorageCleanupDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [orphanInfo, setOrphanInfo] = useState<any>(null);

  const handleCheckOrphans = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-files", {
        body: { action: "count" },
      });

      if (error) throw error;

      setOrphanInfo(data);
      toast.success(`${data.orphanCount} arquivos órfãos encontrados`);
    } catch (error: any) {
      console.error("Erro ao verificar órfãos:", error);
      toast.error("Erro ao verificar arquivos órfãos");
    } finally {
      setChecking(false);
    }
  };

  const handleCleanup = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("cleanup-orphan-files", {
        body: { action: "delete" },
      });

      if (error) throw error;

      toast.success(data.message || "Limpeza concluída com sucesso!");
      setOrphanInfo(null);
      setOpen(false);
    } catch (error: any) {
      console.error("Erro na limpeza:", error);
      toast.error("Erro ao limpar arquivos");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" onClick={handleCheckOrphans}>
          <Trash2 className="mr-2 h-4 w-4" />
          Limpar Storage
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Limpeza de Arquivos Órfãos</DialogTitle>
          <DialogDescription>
            Remove arquivos do Storage que não estão mais referenciados no banco de dados
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {checking ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : orphanInfo ? (
            <>
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p>
                      <strong>Total de arquivos:</strong> {orphanInfo.totalFiles}
                    </p>
                    <p>
                      <strong>Arquivos referenciados:</strong> {orphanInfo.referencedFiles}
                    </p>
                    <p>
                      <strong>Arquivos órfãos:</strong>{" "}
                      <span className="text-destructive font-bold">{orphanInfo.orphanCount}</span>
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              {orphanInfo.orphanCount > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Atenção: Esta ação irá deletar permanentemente {orphanInfo.orphanCount} arquivo(s)
                    que não estão referenciados no banco de dados. Esta ação não pode ser desfeita.
                  </AlertDescription>
                </Alert>
              )}

              {orphanInfo.orphanFiles && orphanInfo.orphanFiles.length > 0 && (
                <div className="max-h-40 overflow-y-auto border rounded-md p-3">
                  <p className="text-sm font-medium mb-2">Exemplos de arquivos órfãos:</p>
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    {orphanInfo.orphanFiles.slice(0, 10).map((file: any, idx: number) => (
                      <li key={idx} className="truncate">
                        • {file.path}
                      </li>
                    ))}
                    {orphanInfo.orphanFiles.length > 10 && (
                      <li className="font-medium">
                        ... e mais {orphanInfo.orphanFiles.length - 10} arquivo(s)
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Clique em "Verificar" para analisar os arquivos órfãos
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          {!orphanInfo && (
            <Button onClick={handleCheckOrphans} disabled={checking}>
              {checking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verificar
            </Button>
          )}
          {orphanInfo && orphanInfo.orphanCount > 0 && (
            <Button variant="destructive" onClick={handleCleanup} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Limpar Agora
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
