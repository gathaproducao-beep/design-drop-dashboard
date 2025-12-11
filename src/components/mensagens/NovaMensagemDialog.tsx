import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
import { Loader2, Plus, X, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TesteEnvioDialog } from "./TesteEnvioDialog";

interface NovaMensagemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingMensagem?: {
    id: string;
    nome: string;
    mensagem: string;
    type?: string;
    is_active?: boolean;
    partes_mensagem?: string[];
  } | null;
  onSuccess: () => void;
}

const VARIAVEIS = [
  { key: "{numero_pedido}", label: "Número do Pedido", exemplo: "PED-2024-001" },
  { key: "{nome_cliente}", label: "Nome do Cliente", exemplo: "João Silva" },
  { key: "{codigo_produto}", label: "Código do Produto", exemplo: "CAMISETA-PRETA-G" },
  { key: "{data_pedido}", label: "Data do Pedido", exemplo: "28/10/2024" },
  { key: "{observacao}", label: "Observação", exemplo: "Entrega urgente" },
  { key: "{foto_aprovacao}", label: "Foto Aprovação", exemplo: "[Link da Foto]" },
];

export const NovaMensagemDialog = ({
  open,
  onOpenChange,
  editingMensagem,
  onSuccess,
}: NovaMensagemDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [testeDialogOpen, setTesteDialogOpen] = useState(false);
  const [partesMensagem, setPartesMensagem] = useState<string[]>([""]);
  const [parteEditando, setParteEditando] = useState<number>(0);
  const [formData, setFormData] = useState({
    nome: "",
    type: "aprovacao" as "aprovacao" | "conclusao",
    is_active: true,
  });

  // Inicializar dados do formulário
  useEffect(() => {
    if (open) {
      if (editingMensagem) {
        setFormData({
          nome: editingMensagem.nome,
          type: (editingMensagem.type as "aprovacao" | "conclusao") || "aprovacao",
          is_active: editingMensagem.is_active ?? true,
        });
        
        // Usar partes_mensagem se existir, senão usar mensagem como primeira parte
        if (editingMensagem.partes_mensagem && editingMensagem.partes_mensagem.length > 0) {
          setPartesMensagem(editingMensagem.partes_mensagem);
        } else if (editingMensagem.mensagem) {
          setPartesMensagem([editingMensagem.mensagem]);
        } else {
          setPartesMensagem([""]);
        }
        setParteEditando(0);
      } else {
        setFormData({
          nome: "",
          type: "aprovacao",
          is_active: true,
        });
        setPartesMensagem([""]);
        setParteEditando(0);
      }
    }
  }, [editingMensagem, open]);

  const adicionarParte = () => {
    setPartesMensagem(prev => [...prev, ""]);
    setParteEditando(partesMensagem.length);
  };

  const removerParte = (index: number) => {
    if (partesMensagem.length <= 1) {
      toast.error("Deve haver pelo menos uma parte na mensagem");
      return;
    }
    setPartesMensagem(prev => prev.filter((_, i) => i !== index));
    if (parteEditando >= index && parteEditando > 0) {
      setParteEditando(parteEditando - 1);
    }
  };

  const moverParte = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= partesMensagem.length) return;

    setPartesMensagem(prev => {
      const newList = [...prev];
      [newList[index], newList[newIndex]] = [newList[newIndex], newList[index]];
      return newList;
    });
    setParteEditando(newIndex);
  };

  const atualizarParte = (index: number, valor: string) => {
    setPartesMensagem(prev => {
      const newList = [...prev];
      newList[index] = valor;
      return newList;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar partes
    const partesValidas = partesMensagem.filter(p => p.trim().length > 0);
    if (partesValidas.length === 0) {
      toast.error("Adicione pelo menos uma parte com conteúdo");
      return;
    }

    setLoading(true);

    try {
      const dataToSave = {
        nome: formData.nome,
        type: formData.type,
        is_active: formData.is_active,
        mensagem: partesValidas[0], // Primeira parte como mensagem principal (compatibilidade)
        partes_mensagem: partesValidas,
      };

      if (editingMensagem) {
        const { error } = await supabase
          .from("mensagens_whatsapp")
          .update(dataToSave)
          .eq("id", editingMensagem.id);

        if (error) throw error;
        toast.success("Mensagem atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("mensagens_whatsapp")
          .insert([dataToSave]);

        if (error) throw error;
        toast.success("Mensagem criada com sucesso!");
      }

      onSuccess();
    } catch (error) {
      toast.error("Erro ao salvar mensagem");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector(`textarea[data-parte="${parteEditando}"]`) as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = partesMensagem[parteEditando];
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;
      
      atualizarParte(parteEditando, newText);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const renderPreview = (texto: string) => {
    let mensagem = texto;
    
    const hasFotoAprovacao = mensagem.includes('{foto_aprovacao}');
    
    if (!hasFotoAprovacao) {
      VARIAVEIS.forEach((variavel) => {
        mensagem = mensagem.replace(
          new RegExp(variavel.key.replace(/[{}]/g, '\\$&'), 'g'),
          variavel.exemplo
        );
      });
      return <p className="text-sm whitespace-pre-wrap">{mensagem}</p>;
    }
    
    const parts = mensagem.split('{foto_aprovacao}');
    
    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          let processedPart = part;
          VARIAVEIS.filter(v => v.key !== '{foto_aprovacao}').forEach((variavel) => {
            processedPart = processedPart.replace(
              new RegExp(variavel.key.replace(/[{}]/g, '\\$&'), 'g'),
              variavel.exemplo
            );
          });
          
          return (
            <div key={index}>
              {processedPart && <p className="text-sm whitespace-pre-wrap">{processedPart}</p>}
              {index < parts.length - 1 && (
                <div className="bg-muted/50 border rounded p-2 text-xs text-muted-foreground">
                  [Imagem de aprovação]
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editingMensagem ? "Editar Mensagem" : "Nova Mensagem WhatsApp"}
          </DialogTitle>
          <DialogDescription>
            Configure as partes da mensagem. Cada parte será enviada como uma mensagem separada, na ordem.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Mensagem</Label>
            <Input
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={(e) => setFormData(prev => ({ ...prev, nome: e.target.value }))}
              placeholder="Ex: Mensagem de Aprovação"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Variáveis Disponíveis</Label>
            <div className="flex flex-wrap gap-2">
              {VARIAVEIS.map((variavel) => (
                <Badge
                  key={variavel.key}
                  variant="secondary"
                  className="cursor-pointer hover:bg-secondary/80"
                  onClick={() => insertVariable(variavel.key)}
                >
                  {variavel.label}
                </Badge>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Clique nas variáveis para inserir na parte selecionada
            </p>
          </div>

          {/* Lista de Partes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Partes da Mensagem ({partesMensagem.length})</Label>
              <Button type="button" variant="outline" size="sm" onClick={adicionarParte}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Parte
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Cada parte será enviada como uma mensagem separada, na ordem abaixo.
            </p>

            <div className="space-y-3">
              {partesMensagem.map((parte, index) => (
                <div 
                  key={index}
                  className={`border rounded-lg p-4 transition-colors ${
                    parteEditando === index ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                  onClick={() => setParteEditando(index)}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-bold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        {index + 1}
                      </span>
                    </div>
                    
                    <div className="flex-1 grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Mensagem {index + 1}</Label>
                        <Textarea
                          data-parte={index}
                          value={parte}
                          onChange={(e) => atualizarParte(index, e.target.value)}
                          onFocus={() => setParteEditando(index)}
                          placeholder={
                            index === 0 ? "Ex: Oi {nome_cliente}, tudo bem?" :
                            `Ex: Parte ${index + 1} da mensagem...`
                          }
                          className="min-h-[100px] text-sm"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Pré-visualização</Label>
                        <div className="min-h-[100px] p-3 rounded-md border bg-muted/30 text-sm">
                          {parte ? renderPreview(parte) : (
                            <span className="text-muted-foreground italic">
                              Digite o texto...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); moverParte(index, 'up'); }}
                        disabled={index === 0}
                      >
                        <ArrowUp className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); moverParte(index, 'down'); }}
                        disabled={index === partesMensagem.length - 1}
                      >
                        <ArrowDown className="h-3 w-3" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removerParte(index); }}
                        disabled={partesMensagem.length <= 1}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Tipo da Mensagem */}
          <div className="space-y-2">
            <Label htmlFor="type">Tipo da Mensagem</Label>
            <Select
              value={formData.type}
              onValueChange={(value: "aprovacao" | "conclusao") =>
                setFormData((prev) => ({ ...prev, type: value }))
              }
            >
              <SelectTrigger id="type">
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aprovacao">Aprovação</SelectItem>
                <SelectItem value="conclusao">Conclusão</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Aprovação: enviada ao gerar mockup. Conclusão: enviada ao aprovar layout.
            </p>
          </div>

          {/* Ativo/Inativo */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="is_active">Mensagem Ativa</Label>
              <p className="text-sm text-muted-foreground">
                Apenas mensagens ativas serão enviadas automaticamente
              </p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, is_active: checked }))
              }
            />
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setTesteDialogOpen(true)}
              disabled={partesMensagem.filter(p => p.trim()).length === 0}
              className="w-full sm:w-auto"
            >
              Testar Envio
            </Button>
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="flex-1 sm:flex-none"
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading} className="flex-1 sm:flex-none">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingMensagem ? "Atualizar" : "Criar"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>

      {/* Dialog de Teste */}
      <TesteEnvioDialog
        open={testeDialogOpen}
        onOpenChange={setTesteDialogOpen}
        mensagemTexto={partesMensagem.filter(p => p.trim()).join('\n---\n')}
        nomeMensagem={formData.nome || "Nova Mensagem"}
        mensagemId={editingMensagem?.id}
      />
    </Dialog>
  );
};
