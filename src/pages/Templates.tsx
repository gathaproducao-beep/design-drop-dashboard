import { useState, useEffect } from "react";
import { Navigation } from "@/components/Navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TemplatesList } from "@/components/templates/TemplatesList";
import { NovoTemplateDialog } from "@/components/templates/NovoTemplateDialog";

type Template = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
};

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [editandoTemplate, setEditandoTemplate] = useState<Template | null>(null);

  const carregarTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('area_templates')
        .select('*')
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

  useEffect(() => {
    carregarTemplates();
  }, []);

  const templatesFiltrados = templates.filter(t =>
    t.name.toLowerCase().includes(busca.toLowerCase()) ||
    t.description?.toLowerCase().includes(busca.toLowerCase())
  );

  const handleEdit = (template: Template) => {
    setEditandoTemplate(template);
    setDialogAberto(true);
  };

  const handleDialogClose = () => {
    setDialogAberto(false);
    setEditandoTemplate(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold">Templates de Áreas</h1>
              <p className="text-muted-foreground mt-1">
                Crie templates reutilizáveis para agilizar a configuração de mockups
              </p>
            </div>
            <Button onClick={() => setDialogAberto(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Buscar templates..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-10"
            />
          </div>

          {carregando ? (
            <div className="text-center py-12 text-muted-foreground">
              Carregando templates...
            </div>
          ) : templatesFiltrados.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {busca ? "Nenhum template encontrado" : "Nenhum template cadastrado"}
            </div>
          ) : (
            <TemplatesList
              templates={templatesFiltrados}
              onEdit={handleEdit}
              onRefresh={carregarTemplates}
            />
          )}
        </div>
      </main>

      <NovoTemplateDialog
        open={dialogAberto}
        onOpenChange={handleDialogClose}
        onSuccess={carregarTemplates}
        editingTemplate={editandoTemplate}
      />
    </div>
  );
}
