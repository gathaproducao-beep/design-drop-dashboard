import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

interface DriveUploadStatusProps {
  status: "uploading" | "success" | "error" | "idle";
  driveUrl?: string;
  onRetry?: () => void;
}

export default function DriveUploadStatus({
  status,
  driveUrl,
  onRetry,
}: DriveUploadStatusProps) {
  if (status === "idle") return null;

  return (
    <div className="flex items-center gap-2">
      {status === "uploading" && (
        <Badge variant="secondary">
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Enviando para Drive...
        </Badge>
      )}

      {status === "success" && driveUrl && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(driveUrl, "_blank")}
        >
          <CheckCircle2 className="h-4 w-4 mr-1 text-green-600" />
          Abrir no Drive
          <ExternalLink className="h-3 w-3 ml-1" />
        </Button>
      )}

      {status === "error" && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">
            <AlertCircle className="h-3 w-3 mr-1" />
            Erro no envio
          </Badge>
          {onRetry && (
            <Button size="sm" variant="ghost" onClick={onRetry}>
              Tentar novamente
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
