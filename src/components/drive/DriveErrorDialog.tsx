import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertCircle, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface DriveErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: {
    operation: string;
    code?: number;
    message: string;
    details?: string;
  };
  onRetry?: () => void;
}

export default function DriveErrorDialog({
  open,
  onOpenChange,
  error,
  onRetry,
}: DriveErrorDialogProps) {
  const { toast } = useToast();

  const copiarErro = () => {
    const errorText = `
Operação: ${error.operation}
Código: ${error.code || "N/A"}
Mensagem: ${error.message}
${error.details ? `Detalhes: ${error.details}` : ""}
    `.trim();

    navigator.clipboard.writeText(errorText);
    toast({
      title: "Copiado!",
      description: "Erro copiado para a área de transferência",
    });
  };

  const getSuggestions = () => {
    if (error.code === 401) {
      return [
        "Verifique se suas credenciais OAuth2 estão corretas",
        "Certifique-se de que o Refresh Token ainda é válido",
        "Teste a conexão novamente em Configurações > Google Drive",
      ];
    }

    if (error.code === 403) {
      if (error.message.includes("quota")) {
        return [
          "Você excedeu o limite de uso da API Google Drive",
          "Aguarde alguns minutos antes de tentar novamente",
          "Considere aumentar a quota no Google Cloud Console",
        ];
      }
      return [
        "Verifique as permissões da conta no Google Drive",
        "Certifique-se de que a API do Drive está habilitada",
      ];
    }

    if (error.code === 404) {
      return [
        "A pasta especificada pode não existir",
        "Verifique o ID da pasta raiz nas configurações",
      ];
    }

    if (error.code === 413) {
      return [
        "O arquivo é muito grande (máximo 10MB)",
        "Comprima a imagem antes de fazer upload",
      ];
    }

    return [
      "Verifique sua conexão com a internet",
      "Tente novamente em alguns instantes",
      "Se o problema persistir, entre em contato com o suporte",
    ];
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <DialogTitle>Erro na Operação do Google Drive</DialogTitle>
          </div>
          <DialogDescription>
            Ocorreu um erro durante a operação: {error.operation}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Informações do Erro */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Código HTTP:</span>
              <span className="text-sm font-mono">{error.code || "N/A"}</span>
            </div>
            <div className="space-y-1">
              <span className="text-sm font-semibold">Mensagem:</span>
              <p className="text-sm text-muted-foreground">{error.message}</p>
            </div>
            {error.details && (
              <div className="space-y-1">
                <span className="text-sm font-semibold">Detalhes:</span>
                <ScrollArea className="h-[100px] border rounded-md p-3 bg-muted/30">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {error.details}
                  </pre>
                </ScrollArea>
              </div>
            )}
          </div>

          {/* Sugestões */}
          <div className="space-y-2">
            <span className="text-sm font-semibold">💡 Sugestões:</span>
            <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
              {getSuggestions().map((suggestion, index) => (
                <li key={index}>{suggestion}</li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={copiarErro}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar Erro
          </Button>
          {onRetry && (
            <Button onClick={onRetry}>
              Tentar Novamente
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
