import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

type Template = {
  id: string;
  name: string;
  description: string | null;
};

type AplicarTemplateDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (templateId: string) => void;
};

export const AplicarTemplateDialog = ({
  open,
  onOpenChange,
  onApply,
}: AplicarTemplateDialogProps) => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    if (open) {
      carregarTemplates();
    }
  }, [open]);

  const carregarTemplates = async () => {
    setCarregando(true);
    try {
      const { data, error } = await supabase
        .from('area_templates')
        .select('id, name, description')
        .order('name');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Erro ao carregar templates:', error);
      toast.error("Erro ao carregar templates");
    } finally {
      setCarregando(false);
    }
  };

  const handleAplicar = () => {
    if (!selectedTemplate) {
      toast.error("Selecione um template");
      return;
    }
    onApply(selectedTemplate);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Aplicar Template</DialogTitle>
          <DialogDescription>
            Selecione um template para aplicar suas áreas ao canvas atual
          </DialogDescription>
        </DialogHeader>

        {carregando ? (
          <div className="text-center py-8 text-muted-foreground">
            Carregando templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum template disponível. Crie um template primeiro.
          </div>
        ) : (
          <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate}>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  <RadioGroupItem value={template.id} id={template.id} />
                  <Label htmlFor={template.id} className="flex-1 cursor-pointer">
                    <div className="font-medium">{template.name}</div>
                    {template.description && (
                      <div className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </div>
                    )}
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleAplicar} disabled={!selectedTemplate || carregando}>
            Aplicar Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
