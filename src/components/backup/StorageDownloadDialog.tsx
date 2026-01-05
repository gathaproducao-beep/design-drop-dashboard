import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { Download, Loader2, FolderArchive, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import JSZip from "jszip";

interface StorageDownloadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DownloadProgress {
  folder: string;
  current: number;
  total: number;
  currentFile: string;
}

// Pastas disponíveis para download dentro do bucket mockup-images
const AVAILABLE_FOLDERS = [
  { id: "mockups", label: "Mockups", path: "mockups" },
];

export function StorageDownloadDialog({ open, onOpenChange }: StorageDownloadDialogProps) {
  const [downloading, setDownloading] = useState(false);
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedFolders, setSelectedFolders] = useState<string[]>(["mockups"]);

  const toggleFolder = (folderId: string) => {
    setSelectedFolders((prev) =>
      prev.includes(folderId)
        ? prev.filter((f) => f !== folderId)
        : [...prev, folderId]
    );
  };

  async function listAllFiles(folderPath: string): Promise<string[]> {
    const allFiles: string[] = [];
    
    const { data, error } = await supabase.storage
      .from("mockup-images")
      .list(folderPath, { limit: 1000 });
    
    if (error) {
      console.error(`Erro ao listar ${folderPath}:`, error);
      return allFiles;
    }

    for (const item of data || []) {
      const path = `${folderPath}/${item.name}`;
      
      if (item.id === null) {
        // É uma pasta, listar recursivamente
        const subFiles = await listAllFiles(path);
        allFiles.push(...subFiles);
      } else {
        // É um arquivo
        allFiles.push(path);
      }
    }

    return allFiles;
  }

  async function downloadFile(path: string): Promise<Blob | null> {
    const { data, error } = await supabase.storage
      .from("mockup-images")
      .download(path);
    
    if (error) {
      console.error(`Erro ao baixar ${path}:`, error);
      return null;
    }

    return data;
  }

  async function handleDownload() {
    if (selectedFolders.length === 0) {
      toast.error("Selecione pelo menos uma pasta");
      return;
    }

    setDownloading(true);
    setCompleted(false);
    setError(null);
    
    try {
      const zip = new JSZip();
      let totalFiles = 0;
      let processedFiles = 0;

      // Primeiro, listar todos os arquivos das pastas selecionadas
      const folderFiles: Record<string, string[]> = {};
      
      for (const folderId of selectedFolders) {
        const folder = AVAILABLE_FOLDERS.find(f => f.id === folderId);
        if (!folder) continue;

        setProgress({ folder: folder.label, current: 0, total: 0, currentFile: "Listando arquivos..." });
        const files = await listAllFiles(folder.path);
        folderFiles[folderId] = files;
        totalFiles += files.length;
        console.log(`[Storage] ${folder.label}: ${files.length} arquivos encontrados`);
      }

      if (totalFiles === 0) {
        toast.info("Nenhum arquivo encontrado nas pastas selecionadas");
        setDownloading(false);
        return;
      }

      // Agora baixar cada arquivo e adicionar ao ZIP
      for (const folderId of selectedFolders) {
        const folder = AVAILABLE_FOLDERS.find(f => f.id === folderId);
        if (!folder) continue;

        const files = folderFiles[folderId];
        
        for (const filePath of files) {
          setProgress({
            folder: folder.label,
            current: processedFiles + 1,
            total: totalFiles,
            currentFile: filePath
          });

          const blob = await downloadFile(filePath);
          
          if (blob) {
            // Adicionar ao ZIP mantendo a estrutura de pastas
            zip.file(filePath, blob);
          }

          processedFiles++;
        }
      }

      // Gerar o ZIP
      setProgress({ folder: "Gerando ZIP", current: totalFiles, total: totalFiles, currentFile: "Comprimindo arquivos..." });
      
      const zipBlob = await zip.generateAsync({ 
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });

      // Download do arquivo
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      const folderNames = selectedFolders.join("-");
      a.download = `storage-${folderNames}-${new Date().toISOString().split("T")[0]}.zip`;
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
            Baixar Storage
          </DialogTitle>
          <DialogDescription>
            Baixa as pastas selecionadas do bucket mockup-images como um arquivo ZIP.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Seleção de pastas */}
          <div className="space-y-3">
            <p className="text-sm font-medium">Selecione as pastas:</p>
            <div className="space-y-2">
              {AVAILABLE_FOLDERS.map((folder) => (
                <div key={folder.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={folder.id}
                    checked={selectedFolders.includes(folder.id)}
                    onCheckedChange={() => toggleFolder(folder.id)}
                    disabled={downloading}
                  />
                  <label
                    htmlFor={folder.id}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {folder.label}
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* Progresso */}
          {downloading && progress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{progress.folder}</span>
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
          <Button onClick={handleDownload} disabled={downloading || selectedFolders.length === 0}>
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
