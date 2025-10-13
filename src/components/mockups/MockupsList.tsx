import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";

interface MockupsListProps {
  mockups: any[];
  loading: boolean;
  onEdit: (mockup: any) => void;
  onRefresh: () => void;
}

export function MockupsList({ mockups, loading, onEdit, onRefresh }: MockupsListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);

  const handleDelete = async (mockupId: string) => {
    if (!confirm("Tem certeza que deseja excluir este mockup?")) return;

    setDeleting(mockupId);
    try {
      const { error } = await supabase
        .from("mockups")
        .delete()
        .eq("id", mockupId);

      if (error) throw error;
      toast.success("Mockup excluído");
      onRefresh();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir mockup");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (mockups.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">
            Nenhum mockup encontrado. Crie um novo mockup para começar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {mockups.map((mockup) => (
        <Card key={mockup.id} className="hover:shadow-lg transition-all">
          <CardHeader>
            <div className="flex items-start justify-between">
              <CardTitle className="text-lg">{mockup.codigo_mockup}</CardTitle>
              <Badge variant={mockup.tipo === "aprovacao" ? "default" : "secondary"}>
                {mockup.tipo}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden mb-4">
              <img
                src={mockup.imagem_base}
                alt={mockup.codigo_mockup}
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {mockup.mockup_areas?.length || 0} área(s) definida(s)
            </p>
          </CardContent>
          <CardFooter className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onEdit(mockup)}
            >
              <Edit className="mr-2 h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleDelete(mockup.id)}
              disabled={deleting === mockup.id}
            >
              {deleting === mockup.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
