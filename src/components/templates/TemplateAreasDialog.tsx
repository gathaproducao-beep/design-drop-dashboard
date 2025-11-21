import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TemplateArea = {
  id: string;
  field_key: string;
  kind: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type TemplateAreasDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  templateName: string;
};

export const TemplateAreasDialog = ({
  open,
  onOpenChange,
  templateId,
  templateName,
}: TemplateAreasDialogProps) => {
  const [areas, setAreas] = useState<TemplateArea[]>([]);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (open && templateId) {
      carregarAreas();
    }
  }, [open, templateId]);

  const carregarAreas = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('area_template_items')
        .select('*')
        .eq('template_id', templateId)
        .order('field_key');

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      console.error('Erro ao carregar áreas:', error);
      toast.error("Erro ao carregar áreas do template");
    } finally {
      setCarregando(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('area_template_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success("Área removida do template!");
      carregarAreas();
    } catch (error) {
      console.error('Erro ao excluir área:', error);
      toast.error("Erro ao excluir área");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Áreas do Template: {templateName}</DialogTitle>
          <DialogDescription>
            Áreas configuradas neste template. Para adicionar áreas, configure-as em um mockup e salve como template.
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando áreas...
          </div>
        ) : areas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma área configurada neste template
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campo</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right">X</TableHead>
                <TableHead className="text-right">Y</TableHead>
                <TableHead className="text-right">Largura</TableHead>
                <TableHead className="text-right">Altura</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {areas.map((area) => (
                <TableRow key={area.id}>
                  <TableCell className="font-medium">{area.field_key}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs bg-secondary text-secondary-foreground">
                      {area.kind === 'image' ? 'Imagem' : 'Texto'}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{Math.round(area.x)}</TableCell>
                  <TableCell className="text-right">{Math.round(area.y)}</TableCell>
                  <TableCell className="text-right">{Math.round(area.width)}</TableCell>
                  <TableCell className="text-right">{Math.round(area.height)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(area.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
