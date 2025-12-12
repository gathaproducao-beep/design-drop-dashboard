import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
  onSuccess: () => void;
}

type Categoria = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';

export const TemplateDialog = ({ open, onOpenChange, template, onSuccess }: TemplateDialogProps) => {
  const [nome, setNome] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("UTILITY");
  const [idioma, setIdioma] = useState("pt_BR");
  const [descricao, setDescricao] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [novaVariavel, setNovaVariavel] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setNome(template.nome || "");
        setTemplateName(template.template_name || "");
        setCategoria(template.categoria || "UTILITY");
        setIdioma(template.idioma || "pt_BR");
        setDescricao(template.descricao || "");
        setVariaveis(template.variaveis || []);
        setIsActive(template.is_active ?? true);
      } else {
        setNome("");
        setTemplateName("");
        setCategoria("UTILITY");
        setIdioma("pt_BR");
        setDescricao("");
        setVariaveis([]);
        setIsActive(true);
      }
      setNovaVariavel("");
    }
  }, [open, template]);

  const handleAddVariavel = () => {
    if (novaVariavel.trim() && !variaveis.includes(novaVariavel.trim())) {
      setVariaveis([...variaveis, novaVariavel.trim()]);
      setNovaVariavel("");
    }
  };

  const handleRemoveVariavel = (index: number) => {
    setVariaveis(variaveis.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    if (!templateName.trim()) {
      toast.error("Nome do template no Meta é obrigatório");
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        nome: nome.trim(),
        template_name: templateName.trim().toLowerCase().replace(/\s+/g, '_'),
        categoria,
        idioma,
        descricao: descricao.trim() || null,
        variaveis,
        is_active: isActive,
      };

      if (template?.id) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update(data)
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("whatsapp_templates")
          .insert([data]);

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar Template" : "Novo Template Meta"}
          </DialogTitle>
          <DialogDescription>
            Configure um template pré-aprovado do Meta Business Suite
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome de Exibição *</Label>
            <Input
              id="nome"
              placeholder="Ex: Confirmação de Pedido"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template no Meta *</Label>
            <Input
              id="template-name"
              placeholder="Ex: order_confirmation"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Exatamente como cadastrado no Meta Business Suite (sem espaços, use underscores)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(value: Categoria) => setCategoria(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">
                    <div className="flex flex-col">
                      <span>Utility (Transacional)</span>
                      <span className="text-xs text-muted-foreground">Mais barato</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="MARKETING">
                    <div className="flex flex-col">
                      <span>Marketing</span>
                      <span className="text-xs text-muted-foreground">Promoções</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="AUTHENTICATION">
                    <div className="flex flex-col">
                      <span>Authentication</span>
                      <span className="text-xs text-muted-foreground">Códigos de verificação</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idioma">Idioma</Label>
              <Select value={idioma} onValueChange={setIdioma}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição / Texto do Template</Label>
            <Textarea
              id="descricao"
              placeholder="Descreva o conteúdo do template para referência..."
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Variáveis do Template</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Adicione as variáveis na ordem em que aparecem no template ({"{{1}}"}, {"{{2}}"}, etc.)
            </p>
            
            <div className="flex gap-2">
              <Input
                placeholder="Nome da variável (ex: nome_cliente)"
                value={novaVariavel}
                onChange={(e) => setNovaVariavel(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddVariavel())}
              />
              <Button type="button" variant="outline" size="icon" onClick={handleAddVariavel}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {variaveis.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {variaveis.map((v, index) => (
                  <Badge key={index} variant="secondary" className="gap-1 pr-1">
                    <span className="text-muted-foreground mr-1">{`{{${index + 1}}}`}</span>
                    {v}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 ml-1 hover:bg-destructive/20"
                      onClick={() => handleRemoveVariavel(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between space-x-2 pt-2">
            <Label htmlFor="active" className="cursor-pointer">
              Template ativo
            </Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
