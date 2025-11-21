import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Folder, File, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TesteDriveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  createdTime: string;
  webViewLink?: string;
}

interface LogEntry {
  timestamp: string;
  message: string;
  type: "success" | "error" | "info";
}

export default function TesteDriveDialog({ open, onOpenChange }: TesteDriveDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (open) {
      listarArquivos();
    }
  }, [open]);

  const addLog = (message: string, type: LogEntry["type"] = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [{ timestamp, message, type }, ...prev].slice(0, 10));
  };

  const listarArquivos = async () => {
    setLoading(true);
    addLog("Listando arquivos do Drive...", "info");

    try {
      const { data, error } = await supabase.functions.invoke("google-drive-operations", {
        body: { action: "list_files", folder_id: "root" },
      });

      if (error) throw error;

      setFiles(data.files || []);
      addLog(`✅ ${data.files?.length || 0} arquivos encontrados`, "success");
    } catch (error: any) {
      console.error("Erro ao listar arquivos:", error);
      addLog(`❌ Erro: ${error.message}`, "error");
      toast({
        title: "Erro ao listar arquivos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const criarPastaTeste = async () => {
    setLoading(true);
    const folderName = `Teste Lovable - ${new Date().toLocaleString()}`;
    addLog(`Criando pasta: ${folderName}`, "info");

    try {
      const { data, error } = await supabase.functions.invoke("google-drive-operations", {
        body: {
          action: "create_folder",
          name: folderName,
          parent_folder_id: "root",
        },
      });

      if (error) throw error;

      addLog(`✅ Pasta criada com sucesso: ${data.name}`, "success");
      toast({
        title: "Pasta criada!",
        description: `A pasta "${folderName}" foi criada no Drive`,
      });

      // Atualizar lista de arquivos
      await listarArquivos();
    } catch (error: any) {
      console.error("Erro ao criar pasta:", error);
      addLog(`❌ Erro ao criar pasta: ${error.message}`, "error");
      toast({
        title: "Erro ao criar pasta",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>🧪 Teste de Integração Google Drive</DialogTitle>
          <DialogDescription>
            Teste as operações de listagem e criação de pastas no Drive
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Status:</span>
            <Badge variant="default">✅ Conectado</Badge>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button onClick={listarArquivos} disabled={loading} variant="outline">
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Atualizar
            </Button>
            <Button onClick={criarPastaTeste} disabled={loading}>
              Criar Pasta Teste
            </Button>
          </div>

          {/* Lista de Arquivos */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">📁 Arquivos no Drive:</h3>
            <ScrollArea className="h-[200px] border rounded-md p-4">
              {files.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum arquivo encontrado
                </p>
              ) : (
                <div className="space-y-2">
                  {files.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-2 text-sm hover:bg-muted p-2 rounded"
                    >
                      {file.mimeType === "application/vnd.google-apps.folder" ? (
                        <Folder className="h-4 w-4 text-blue-500" />
                      ) : (
                        <File className="h-4 w-4 text-gray-500" />
                      )}
                      <span className="flex-1">{file.name}</span>
                      {file.webViewLink && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => window.open(file.webViewLink, "_blank")}
                        >
                          Abrir
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Log de Ações */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">📋 Log de Operações:</h3>
            <ScrollArea className="h-[150px] border rounded-md p-4 bg-muted/30">
              {logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma operação realizada ainda
                </p>
              ) : (
                <div className="space-y-1 font-mono text-xs">
                  {logs.map((log, index) => (
                    <div
                      key={index}
                      className={`${
                        log.type === "success"
                          ? "text-green-600"
                          : log.type === "error"
                          ? "text-red-600"
                          : "text-foreground"
                      }`}
                    >
                      <span className="text-muted-foreground">{log.timestamp}</span>{" "}
                      {log.message}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
