import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NovoTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  editingTemplate?: {
    id: string;
    name: string;
    description: string | null;
  } | null;
};

export const NovoTemplateDialog = ({
  open,
  onOpenChange,
  onSuccess,
  editingTemplate,
}: NovoTemplateDialogProps) => {
  const [nome, setNome] = useState(editingTemplate?.name || "");
  const [descricao, setDescricao] = useState(editingTemplate?.description || "");
  const [salvando, setSalvando] = useState(false);

  const resetForm = () => {
    setNome("");
    setDescricao("");
  };

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    setSalvando(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from('area_templates')
          .update({
            name: nome,
            description: descricao || null,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from('area_templates')
          .insert({
            name: nome,
            description: descricao || null,
          });

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar template:', error);
      toast.error("Erro ao salvar template");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {editingTemplate ? "Editar Template" : "Novo Template de Áreas"}
          </DialogTitle>
          <DialogDescription>
            {editingTemplate 
              ? "Altere as informações do template"
              : "Crie um template que pode ser reutilizado em múltiplos mockups"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Layout Camiseta Básica"
            />
          </div>

          <div>
            <Label htmlFor="descricao">Descrição</Label>
            <Textarea
              id="descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descreva o template (opcional)"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : editingTemplate ? "Atualizar" : "Criar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
