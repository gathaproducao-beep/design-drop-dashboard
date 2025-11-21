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

type SalvarTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  areas: Array<{
    field_key: string;
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    z_index?: number;
    font_size?: number;
    font_family?: string;
    font_weight?: string;
    color?: string;
    text_align?: string;
    letter_spacing?: number;
    line_height?: number;
    rotation?: number;
  }>;
};

export const SalvarTemplateDialog = ({
  open,
  onOpenChange,
  areas,
}: SalvarTemplateDialogProps) => {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!nome.trim()) {
      toast.error("Digite um nome para o template");
      return;
    }

    if (areas.length === 0) {
      toast.error("Não há áreas para salvar no template");
      return;
    }

    setSalvando(true);
    try {
      // Criar o template
      const { data: template, error: templateError } = await supabase
        .from('area_templates')
        .insert({
          name: nome,
          description: descricao || null,
        })
        .select()
        .single();

      if (templateError) throw templateError;

      // Inserir as áreas do template
      const templateItems = areas.map(area => ({
        template_id: template.id,
        field_key: area.field_key,
        kind: area.kind,
        x: area.x,
        y: area.y,
        width: area.width,
        height: area.height,
        z_index: area.z_index || 1,
        font_size: area.font_size || 16,
        font_family: area.font_family || 'Arial',
        font_weight: area.font_weight || 'normal',
        color: area.color || '#000000',
        text_align: area.text_align || 'left',
        letter_spacing: area.letter_spacing || 0,
        line_height: area.line_height || 1.2,
        rotation: area.rotation || 0,
      }));

      const { error: itemsError } = await supabase
        .from('area_template_items')
        .insert(templateItems);

      if (itemsError) throw itemsError;

      toast.success(`Template "${nome}" criado com ${areas.length} área(s)!`);
      setNome("");
      setDescricao("");
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
          <DialogTitle>Salvar como Template</DialogTitle>
          <DialogDescription>
            Salve as {areas.length} área(s) do canvas atual como um template reutilizável
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="nome">Nome do Template *</Label>
            <Input
              id="nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Layout Camiseta Frente"
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
            {salvando ? "Salvando..." : "Criar Template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
