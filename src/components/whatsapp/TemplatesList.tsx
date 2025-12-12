import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, FileText, AlertCircle, Image, ExternalLink } from "lucide-react";
import { TemplateDialog } from "./TemplateDialog";
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

interface WhatsappTemplate {
  id: string;
  nome: string;
  template_name: string;
  categoria: string;
  idioma: string;
  descricao: string | null;
  variaveis: string[];
  is_active: boolean;
  status: string | null;
  has_header_media: boolean | null;
  header_media_field: string | null;
}

export const TemplatesList = () => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsappTemplate | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Buscar templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ["whatsapp-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as WhatsappTemplate[];
    },
  });

  // Mutation para alternar status
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .update({ is_active: isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
    },
  });

  // Mutation para deletar
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("whatsapp_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
      toast({
        title: "Template excluído",
        description: "O template foi removido com sucesso",
      });
      setDeleteDialogOpen(false);
      setTemplateToDelete(null);
    },
  });

  const handleAdd = () => {
    setSelectedTemplate(null);
    setDialogOpen(true);
  };

  const handleEdit = (template: WhatsappTemplate) => {
    setSelectedTemplate(template);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setTemplateToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (templateToDelete) {
      deleteMutation.mutate(templateToDelete);
    }
  };

  const getCategoriaColor = (categoria: string) => {
    switch (categoria) {
      case 'UTILITY':
        return 'bg-green-600 hover:bg-green-700';
      case 'MARKETING':
        return 'bg-purple-600 hover:bg-purple-700';
      case 'AUTHENTICATION':
        return 'bg-blue-600 hover:bg-blue-700';
      default:
        return '';
    }
  };

  const getCategoriaLabel = (categoria: string) => {
    switch (categoria) {
      case 'UTILITY':
        return 'Transacional';
      case 'MARKETING':
        return 'Marketing';
      case 'AUTHENTICATION':
        return 'Autenticação';
      default:
        return categoria;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'aprovado':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">🟢 Aprovado</Badge>;
      case 'rejeitado':
        return <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-200">🔴 Rejeitado</Badge>;
      default:
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-200">🟡 Pendente</Badge>;
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Templates Meta (API Oficial)
              </CardTitle>
              <CardDescription>
                Templates pré-aprovados no Meta Business Suite para envio via API Oficial
              </CardDescription>
            </div>
            <Button onClick={handleAdd}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Aviso sobre templates */}
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-medium mb-1">Templates precisam estar aprovados no Meta</p>
                <p className="text-amber-700 dark:text-amber-300">
                  Crie e aprove templates no{" "}
                  <a 
                    href="https://business.facebook.com/wa/manage/message-templates/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="underline inline-flex items-center gap-1"
                  >
                    Meta Business Suite <ExternalLink className="h-3 w-3" />
                  </a>
                  . Use variáveis <strong>nomeadas</strong> como {"{{numero_pedido}}"}.
                </p>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando templates...
            </div>
          ) : !templates || templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum template configurado</p>
              <p className="text-sm mt-2">Adicione templates aprovados no Meta para usar com a API Oficial</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-center justify-between p-4 border rounded-lg bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Switch
                      checked={template.is_active}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: template.id, isActive: checked })
                      }
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{template.nome}</p>
                        {getStatusBadge(template.status)}
                        <Badge className={getCategoriaColor(template.categoria)}>
                          {getCategoriaLabel(template.categoria)}
                        </Badge>
                        <Badge variant="outline">{template.idioma}</Badge>
                        {template.has_header_media && (
                          <Badge variant="secondary" className="gap-1">
                            <Image className="h-3 w-3" />
                            Imagem
                          </Badge>
                        )}
                        {!template.is_active && (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">
                        <code className="bg-muted px-1 py-0.5 rounded text-xs">
                          {template.template_name}
                        </code>
                        {template.variaveis && template.variaveis.length > 0 && (
                          <span className="ml-2">
                            • {template.variaveis.length} variáve{template.variaveis.length > 1 ? 'is' : 'l'}
                          </span>
                        )}
                      </p>
                      {template.descricao && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {template.descricao}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(template)}
                      title="Editar"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(template.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <TemplateDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        template={selectedTemplate}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["whatsapp-templates"] });
        }}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este template? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};