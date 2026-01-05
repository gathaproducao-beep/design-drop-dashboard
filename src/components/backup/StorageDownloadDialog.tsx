import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, FolderArchive, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

interface StorageDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DownloadProgress {
  bucket: string;
  current: number;
  total: number;
  currentFile: string;
}

export function StorageDownloadDialog({ open, onOpenChange }: StorageDownloadDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buckets = ["mockup-images", "whatsapp-media"];

  async function listAllFiles(bucket: string, folder: string = ""): Promise<string[]> {
    const allFiles: string[] = [];
    
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: 1000 });
    
    if (error) {
      console.error(`Erro ao listar ${bucket}/${folder}:`, error);
      return allFiles;
    }

    for (const item of data || []) {
      const path = folder ? `${folder}/${item.name}` : item.name;
      
      if (item.id === null) {
        // É uma pasta, listar recursivamente
        const subFiles = await listAllFiles(bucket, path);
        allFiles.push(...subFiles);
      } else {
        // É um arquivo
        allFiles.push(path);
      }
    }

    return allFiles;
  }

  async function downloadFile(bucket: string, path: string): Promise<Blob | null> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
    
    if (error) {
      console.error(`Erro ao baixar ${bucket}/${path}:`, error);
      return null;
    }

    return data;
  }

  async function handleDownload() {
    setDownloading(true);
    setCompleted(false);
    setError(null);
    
    try {
      const zip = new JSZip();
      let totalFiles = 0;
      let processedFiles = 0;

      // Primeiro, listar todos os arquivos de todos os buckets
      const bucketFiles: Record<string, string[]> = {};
      
      for (const bucket of buckets) {
        setProgress({ bucket, current: 0, total: 0, currentFile: "Listando arquivos..." });
        const files = await listAllFiles(bucket);
        bucketFiles[bucket] = files;
        totalFiles += files.length;
        console.log(`[Storage] ${bucket}: ${files.length} arquivos encontrados`);
      }

      if (totalFiles === 0) {
        toast.info("Nenhum arquivo encontrado nos buckets");
        setDownloading(false);
        return;
      }

      // Agora baixar cada arquivo e adicionar ao ZIP
      for (const bucket of buckets) {
        const files = bucketFiles[bucket];
        const bucketFolder = zip.folder(bucket);
        
        for (const filePath of files) {
          setProgress({
            bucket,
            current: processedFiles + 1,
            total: totalFiles,
            currentFile: filePath
          });

          const blob = await downloadFile(bucket, filePath);
          
          if (blob) {
            // Criar estrutura de pastas no ZIP
            const pathParts = filePath.split("/");
            let currentFolder = bucketFolder;
            
            for (let i = 0; i < pathParts.length - 1; i++) {
              currentFolder = currentFolder!.folder(pathParts[i]);
            }
            
            const fileName = pathParts[pathParts.length - 1];
            currentFolder!.file(fileName, blob);
          }

          processedFiles++;
        }
      }

      // Gerar o ZIP
      setProgress({ bucket: "Gerando ZIP", current: totalFiles, total: totalFiles, currentFile: "Comprimindo arquivos..." });
      
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      }, (metadata) => {
        // Progress callback do ZIP
      });

      // Download do arquivo
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `storage-backup-${new Date().toISOString().split("T")[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setCompleted(true);
      toast.success(`Backup baixado com sucesso! ${totalFiles} arquivos`);
    } catch (err) {
      console.error("Erro no download:", err);
      setError(err instanceof Error ? err.message : "Erro desconhecido");
      toast.error("Erro ao fazer backup do Storage");
    } finally {
      setDownloading(false);
    }
  }

  const progressPercent = progress ? (progress.current / progress.total) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderArchive className="h-5 w-5" />
            Baixar Storage Completo
          </DialogTitle>
          <DialogDescription>
            Baixa todos os arquivos dos buckets como um arquivo ZIP mantendo a estrutura de pastas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Lista de buckets */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Buckets incluídos:</p>
            <div className="space-y-1">
              {buckets.map((bucket) => (
                <div key={bucket} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="w-2 h-2 rounded-full bg-primary" />
                  {bucket}
                </div>
              ))}
            </div>
          </div>

          {/* Progresso */}
          {downloading && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{progress.bucket}</span>
                <span className="font-medium">{progress.current} / {progress.total}</span>
              </div>
              <Progress value={progressPercent} className="h-2" />
              <p className="text-xs text-muted-foreground truncate">
                {progress.currentFile}
              </p>
            </div>
          )}

          {/* Sucesso */}
          {completed && (
            <div className="flex items-center gap-2 p-3 bg-green-500/10 text-green-600 rounded-lg">
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-sm font-medium">Download concluído com sucesso!</span>
            </div>
          )}

          {/* Erro */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
              <AlertCircle className="h-5 w-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={downloading}>
            Fechar
          </Button>
          <Button onClick={handleDownload} disabled={downloading}>
            {downloading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Baixando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Baixar ZIP
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
