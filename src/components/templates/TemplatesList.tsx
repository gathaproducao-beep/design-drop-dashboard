import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Edit, Trash2, Copy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Template = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

type TemplatesListProps = {
  templates: Template[];
  onEdit: (template: Template) => void;
  onRefresh: () => void;
  onApply?: (templateId: string) => void;
};

export const TemplatesList = ({ templates, onEdit, onRefresh, onApply }: TemplatesListProps) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('area_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success("Template excluído com sucesso!");
      onRefresh();
    } catch (error) {
      console.error('Erro ao excluir template:', error);
      toast.error("Erro ao excluir template");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader>
              <CardTitle className="text-lg">{template.name}</CardTitle>
              {template.description && (
                <CardDescription>{template.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {onApply && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onApply(template.id)}
                    className="flex-1"
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Aplicar
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEdit(template)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeletingId(template.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingId && handleDelete(deletingId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
