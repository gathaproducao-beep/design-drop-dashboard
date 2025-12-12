import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, AlertTriangle } from "lucide-react";

interface AtualizarLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (campo: string, valor: string) => Promise<void>;
}

type CampoType = "mensagem_enviada" | "layout_aprovado" | "data_impressao" | "observacao";

const CAMPOS = [
  { value: "mensagem_enviada", label: "Mensagem" },
  { value: "layout_aprovado", label: "Layout" },
  { value: "data_impressao", label: "Data Impressão" },
  { value: "observacao", label: "Observação" },
];

const VALORES_MENSAGEM = [
  { value: "pendente", label: "Pendente" },
  { value: "enviando", label: "Enviando" },
  { value: "enviada", label: "Enviada" },
  { value: "erro", label: "Erro" },
  { value: "reenviar", label: "Reenviar" },
];

const VALORES_LAYOUT = [
  { value: "pendente", label: "Pendente" },
  { value: "aprovado", label: "Aprovado" },
  { value: "reprovado", label: "Reprovado" },
  { value: "fazer_manual", label: "Fazer Manual" },
];

export function AtualizarLoteDialog({
  open,
  onOpenChange,
  selectedCount,
  onConfirm,
}: AtualizarLoteDialogProps) {
  const [campo, setCampo] = useState<CampoType | "">("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!campo || !valor) return;
    
    setLoading(true);
    try {
      await onConfirm(campo, valor);
      onOpenChange(false);
      setCampo("");
      setValor("");
    } finally {
      setLoading(false);
    }
  };

  const handleCampoChange = (novoCampo: CampoType) => {
    setCampo(novoCampo);
    setValor("");
  };

  const renderInputValor = () => {
    if (!campo) return null;

    switch (campo) {
      case "mensagem_enviada":
        return (
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {VALORES_MENSAGEM.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "layout_aprovado":
        return (
          <Select value={valor} onValueChange={setValor}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o status" />
            </SelectTrigger>
            <SelectContent>
              {VALORES_LAYOUT.map((v) => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case "data_impressao":
        return (
          <Input
            type="date"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
          />
        );

      case "observacao":
        return (
          <Textarea
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Digite a observação..."
            rows={3}
          />
        );

      default:
        return null;
    }
  };

  const getCampoLabel = () => {
    return CAMPOS.find((c) => c.value === campo)?.label || "";
  };

  const getValorLabel = () => {
    if (campo === "mensagem_enviada") {
      return VALORES_MENSAGEM.find((v) => v.value === valor)?.label || valor;
    }
    if (campo === "layout_aprovado") {
      return VALORES_LAYOUT.find((v) => v.value === valor)?.label || valor;
    }
    return valor;
  };

  const isReenviar = campo === "mensagem_enviada" && valor === "reenviar";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atualizar em Lote</DialogTitle>
          <DialogDescription>
            Atualizando {selectedCount} pedido(s) selecionado(s)
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>Campo</Label>
            <Select value={campo} onValueChange={(v) => handleCampoChange(v as CampoType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o campo" />
              </SelectTrigger>
              <SelectContent>
                {CAMPOS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {campo && (
            <div className="grid gap-2">
              <Label>Novo valor</Label>
              {renderInputValor()}
            </div>
          )}

          {campo && valor && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                {isReenviar ? (
                  <>
                    Esta ação irá <strong>adicionar {selectedCount} mensagem(ns) à fila do WhatsApp</strong> para reenvio.
                  </>
                ) : (
                  <>
                    Esta ação irá atualizar o campo "<strong>{getCampoLabel()}</strong>" para "<strong>{getValorLabel()}</strong>" em <strong>{selectedCount} pedido(s)</strong>. Isso não pode ser desfeito.
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!campo || !valor || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Atualizar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
