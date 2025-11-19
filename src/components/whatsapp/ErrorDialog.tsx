import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ErrorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedido: string;
  errorMessage: string;
}

export function ErrorDialog({ open, onOpenChange, pedido, errorMessage }: ErrorDialogProps) {
  // Tenta parsear JSON se for um erro estruturado
  let parsedError: any;
  try {
    parsedError = JSON.parse(errorMessage);
  } catch {
    parsedError = null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Erro no Envio - Pedido {pedido}
          </DialogTitle>
          <DialogDescription>
            Detalhes do erro ocorrido durante o envio da mensagem
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          <div className="space-y-4">
            {parsedError ? (
              <>
                {parsedError.error && (
                  <Alert variant="destructive">
                    <AlertDescription>
                      <strong>Erro:</strong> {parsedError.error}
                    </AlertDescription>
                  </Alert>
                )}

                {parsedError.details && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Detalhes:</h4>
                    <div className="bg-muted p-3 rounded-md text-sm">
                      {parsedError.details.status && (
                        <div>
                          <strong>Status:</strong> {parsedError.details.status}
                        </div>
                      )}
                      {parsedError.details.error && (
                        <div>
                          <strong>Tipo:</strong> {parsedError.details.error}
                        </div>
                      )}
                      {parsedError.details.response && (
                        <div className="mt-2">
                          <strong>Resposta:</strong>
                          <pre className="mt-1 text-xs overflow-x-auto">
                            {JSON.stringify(parsedError.details.response, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {parsedError.message && parsedError.message !== parsedError.error && (
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Mensagem:</h4>
                    <div className="bg-muted p-3 rounded-md text-sm">
                      {parsedError.message}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertDescription className="whitespace-pre-wrap">
                  {errorMessage}
                </AlertDescription>
              </Alert>
            )}

            {parsedError?.details?.response?.message && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Informações Adicionais:</h4>
                <div className="bg-muted p-3 rounded-md text-sm">
                  {Array.isArray(parsedError.details.response.message) ? (
                    <ul className="list-disc list-inside space-y-1">
                      {parsedError.details.response.message.map((msg: any, idx: number) => (
                        <li key={idx}>
                          {msg.jid && <span className="font-mono">{msg.jid}</span>}
                          {msg.exists !== undefined && (
                            <span> - Existe: {msg.exists ? "Sim" : "Não"}</span>
                          )}
                          {msg.number && <span> (Número: {msg.number})</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div>{parsedError.details.response.message}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
