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
import { Loader2 } from "lucide-react";
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
  const [formData, setFormData] = useState({
    nome: "",
    mensagem: "",
    type: "aprovacao" as "aprovacao" | "conclusao",
    is_active: true,
  });

  useEffect(() => {
    if (editingMensagem) {
      setFormData({
        nome: editingMensagem.nome,
        mensagem: editingMensagem.mensagem,
        type: (editingMensagem.type as "aprovacao" | "conclusao") || "aprovacao",
        is_active: editingMensagem.is_active ?? true,
      });
    } else {
      setFormData({
        nome: "",
        mensagem: "",
        type: "aprovacao",
        is_active: true,
      });
    }
  }, [editingMensagem, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingMensagem) {
        const { error } = await supabase
          .from("mensagens_whatsapp")
          .update(formData)
          .eq("id", editingMensagem.id);

        if (error) throw error;
        toast.success("Mensagem atualizada com sucesso!");
      } else {
        const { error } = await supabase
          .from("mensagens_whatsapp")
          .insert([formData]);

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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const insertVariable = (variable: string) => {
    const textarea = document.querySelector('textarea[name="mensagem"]') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.mensagem;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + variable + after;
      
      setFormData((prev) => ({
        ...prev,
        mensagem: newText,
      }));

      // Restore cursor position
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variable.length, start + variable.length);
      }, 0);
    }
  };

  const renderPreviewMensagem = () => {
    let mensagem = formData.mensagem;
    
    // Check if message contains foto_aprovacao variable
    const hasFotoAprovacao = mensagem.includes('{foto_aprovacao}');
    
    if (!hasFotoAprovacao) {
      // Simple text replacement for messages without images
      VARIAVEIS.forEach((variavel) => {
        mensagem = mensagem.replace(
          new RegExp(variavel.key.replace(/[{}]/g, '\\$&'), 'g'),
          variavel.exemplo
        );
      });
      return <p className="text-sm">{mensagem}</p>;
    }
    
    // Split message by foto_aprovacao variable
    const parts = mensagem.split('{foto_aprovacao}');
    
    return (
      <div className="space-y-2">
        {parts.map((part, index) => {
          // Replace other variables in this part
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
                <img 
                  src="https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&h=300&fit=crop" 
                  alt="Exemplo de foto de aprovação"
                  className="rounded-md my-2 max-w-full h-auto"
                />
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
            Configure o template de mensagem com variáveis dinâmicas
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome da Mensagem</Label>
            <Input
              id="nome"
              name="nome"
              value={formData.nome}
              onChange={handleChange}
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
              Clique nas variáveis acima para inseri-las na mensagem
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="mensagem">Mensagem</Label>
              <Textarea
                id="mensagem"
                name="mensagem"
                value={formData.mensagem}
                onChange={handleChange}
                placeholder="Digite sua mensagem aqui. Use as variáveis acima para personalizar."
                className="min-h-[200px]"
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="min-h-[200px] p-4 rounded-md border bg-muted/50">
                {formData.mensagem ? (
                  renderPreviewMensagem()
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    A pré-visualização aparecerá aqui conforme você digita...
                  </p>
                )}
              </div>
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
              disabled={!formData.mensagem}
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
        mensagemTexto={formData.mensagem}
        nomeMensagem={formData.nome || "Nova Mensagem"}
        mensagemId={editingMensagem?.id}
      />
    </Dialog>
  );
};
