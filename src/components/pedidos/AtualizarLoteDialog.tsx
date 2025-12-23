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
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle, Image, FileImage } from "lucide-react";

interface AtualizarLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCount: number;
  onConfirm: (campo: string, valor: string) => Promise<void>;
  onGerarMockups?: (tipo: 'aprovacao' | 'molde') => Promise<void>;
  gerandoMockups?: boolean;
  progressoMockups?: { atual: number; total: number; pedidoAtual?: string };
}

type CampoType = "mensagem_enviada" | "layout_aprovado" | "data_impressao" | "observacao" | "gerar_foto_aprovacao" | "gerar_molde";

const CAMPOS = [
  { value: "mensagem_enviada", label: "Mensagem" },
  { value: "layout_aprovado", label: "Layout" },
  { value: "data_impressao", label: "Data Impressão" },
  { value: "observacao", label: "Observação" },
  { value: "gerar_foto_aprovacao", label: "Gerar Foto Aprovação", icon: Image },
  { value: "gerar_molde", label: "Gerar Molde Produção", icon: FileImage },
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
  onGerarMockups,
  gerandoMockups = false,
  progressoMockups,
}: AtualizarLoteDialogProps) {
  const [campo, setCampo] = useState<CampoType | "">("");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);

  const isGerarMockup = campo === "gerar_foto_aprovacao" || campo === "gerar_molde";

  const handleConfirm = async () => {
    if (!campo) return;
    
    // Para campos de geração de mockup
    if (isGerarMockup) {
      if (!onGerarMockups) return;
      const tipo = campo === "gerar_foto_aprovacao" ? 'aprovacao' : 'molde';
      await onGerarMockups(tipo);
      return;
    }
    
    // Para campos normais, valor é obrigatório
    if (!valor) return;
    
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

  const handleClose = (newOpen: boolean) => {
    // Não fechar se estiver gerando mockups
    if (gerandoMockups) return;
    onOpenChange(newOpen);
    if (!newOpen) {
      setCampo("");
      setValor("");
    }
  };

  const renderInputValor = () => {
    if (!campo) return null;

    // Campos de geração não precisam de input adicional
    if (isGerarMockup) {
      return null;
    }

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
  const canConfirm = isGerarMockup ? !!campo : (!!campo && !!valor);

  const progressPercent = progressoMockups && progressoMockups.total > 0 
    ? (progressoMockups.atual / progressoMockups.total) * 100 
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atualizar em Lote</DialogTitle>
          <DialogDescription>
            Atualizando {selectedCount} pedido(s) selecionado(s)
          </DialogDescription>
        </DialogHeader>

        {gerandoMockups && progressoMockups ? (
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Gerando mockups...</span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progresso</span>
                <span>{progressoMockups.atual} de {progressoMockups.total}</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
            </div>
            
            {progressoMockups.pedidoAtual && (
              <p className="text-sm text-center text-muted-foreground">
                Processando: <span className="font-medium">{progressoMockups.pedidoAtual}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Campo</Label>
              <Select value={campo} onValueChange={(v) => handleCampoChange(v as CampoType)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o campo" />
                </SelectTrigger>
                <SelectContent>
                  {CAMPOS.map((c) => {
                    const Icon = (c as any).icon;
                    return (
                      <SelectItem key={c.value} value={c.value}>
                        <div className="flex items-center gap-2">
                          {Icon && <Icon className="h-4 w-4" />}
                          {c.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {campo && !isGerarMockup && (
              <div className="grid gap-2">
                <Label>Novo valor</Label>
                {renderInputValor()}
              </div>
            )}

            {campo && (isGerarMockup || valor) && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  {isGerarMockup ? (
                    <>
                      Esta ação irá <strong>gerar {campo === "gerar_foto_aprovacao" ? "fotos de aprovação" : "moldes de produção"}</strong> para <strong>{selectedCount} pedido(s)</strong>.
                      <br />
                      <span className="text-xs mt-1 block opacity-80">
                        Apenas pedidos com foto do cliente e mockup configurado serão processados.
                      </span>
                    </>
                  ) : isReenviar ? (
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
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleClose(false)} disabled={loading || gerandoMockups}>
            {gerandoMockups ? "Processando..." : "Cancelar"}
          </Button>
          {!gerandoMockups && (
            <Button onClick={handleConfirm} disabled={!canConfirm || loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isGerarMockup ? "Gerar" : "Atualizar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
