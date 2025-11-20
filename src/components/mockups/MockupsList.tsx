import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Loader2, Trash2, Copy, Image as ImageIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState, useEffect } from "react";

interface MockupsListProps {
  mockups: any[];
  loading: boolean;
  onEdit: (mockup: any) => void;
  onRefresh: () => void;
}

export function MockupsList({ mockups, loading, onEdit, onRefresh }: MockupsListProps) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [canvasImages, setCanvasImages] = useState<Record<string, string>>({});
  const [mockupsVinculados, setMockupsVinculados] = useState<Record<string, any>>({});

  useEffect(() => {
    const loadCanvasImages = async () => {
      const images: Record<string, string> = {};
      
      for (const mockup of mockups) {
        if (!mockup.imagem_base) {
          const { data: canvases } = await supabase
            .from("mockup_canvases")
            .select("imagem_base")
            .eq("mockup_id", mockup.id)
            .order("ordem", { ascending: true })
            .limit(1)
            .single();
          
          if (canvases?.imagem_base) {
            images[mockup.id] = canvases.imagem_base;
          }
        }
      }
      
      setCanvasImages(images);
    };

    const loadMockupsVinculados = async () => {
      const vinculados: Record<string, any> = {};
      
      for (const mockup of mockups) {
        if (mockup.mockup_aprovacao_vinculado_id) {
          const { data: mockupVinculado } = await supabase
            .from("mockups")
            .select("codigo_mockup")
            .eq("id", mockup.mockup_aprovacao_vinculado_id)
            .single();
          
          if (mockupVinculado) {
            vinculados[mockup.id] = mockupVinculado;
          }
        }
      }
      
      setMockupsVinculados(vinculados);
    };

    if (mockups.length > 0) {
      loadCanvasImages();
      loadMockupsVinculados();
    }
  }, [mockups]);

  const getPreviewImage = (mockup: any) => {
    return mockup.imagem_base || canvasImages[mockup.id] || null;
  };

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

  const handleDuplicate = async (mockup: any) => {
    const novoCodigo = prompt("Código do novo mockup:", `${mockup.codigo_mockup}-COPIA`);
    if (!novoCodigo) return;

    setDuplicating(mockup.id);
    try {
      // Criar novo mockup
      const { data: novoMockup, error: mockupError } = await supabase
        .from("mockups")
        .insert([
          {
            codigo_mockup: novoCodigo,
            tipo: mockup.tipo,
            mockup_aprovacao_vinculado_id: mockup.mockup_aprovacao_vinculado_id,
            imagem_base: mockup.imagem_base,
          },
        ])
        .select()
        .single();

      if (mockupError) throw mockupError;

      // Carregar canvases originais
      const { data: canvases, error: canvasError } = await (supabase as any)
        .from("mockup_canvases")
        .select("*")
        .eq("mockup_id", mockup.id);

      if (canvasError) throw canvasError;

      // Duplicar cada canvas
      for (const canvas of canvases || []) {
        const { data: novoCanvas, error: novoCanvasError } = await (supabase as any)
          .from("mockup_canvases")
          .insert([
            {
              mockup_id: novoMockup.id,
              nome: canvas.nome,
              imagem_base: canvas.imagem_base,
              ordem: canvas.ordem,
            },
          ])
          .select()
          .single();

        if (novoCanvasError) throw novoCanvasError;

        // Carregar e duplicar áreas do canvas
        const { data: areas, error: areasError } = await (supabase as any)
          .from("mockup_areas")
          .select("*")
          .eq("canvas_id", canvas.id);

        if (areasError) throw areasError;

        if (areas && areas.length > 0) {
          const novasAreas = areas.map((area: any) => ({
            mockup_id: novoMockup.id,
            canvas_id: novoCanvas.id,
            kind: area.kind,
            field_key: area.field_key,
            x: area.x,
            y: area.y,
            width: area.width,
            height: area.height,
            z_index: area.z_index,
            font_family: area.font_family,
            font_size: area.font_size,
            font_weight: area.font_weight,
            color: area.color,
            text_align: area.text_align,
            letter_spacing: area.letter_spacing,
            line_height: area.line_height,
          }));

          const { error: insertAreasError } = await (supabase as any)
            .from("mockup_areas")
            .insert(novasAreas);

          if (insertAreasError) throw insertAreasError;
        }
      }

      toast.success("Mockup duplicado com sucesso!");
      onRefresh();
    } catch (error) {
      console.error("Erro ao duplicar:", error);
      toast.error("Erro ao duplicar mockup");
    } finally {
      setDuplicating(null);
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
            {mockupsVinculados[mockup.id] && (
              <p className="text-xs text-muted-foreground mt-2">
                Vinculado: {mockupsVinculados[mockup.id].codigo_mockup}
              </p>
            )}
          </CardHeader>
          <CardContent>
            <div className="relative w-full h-48 bg-muted rounded-lg overflow-hidden mb-4 flex items-center justify-center">
              {getPreviewImage(mockup) ? (
                <img
                  src={getPreviewImage(mockup)}
                  alt={mockup.codigo_mockup}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="h-16 w-16 text-muted-foreground/30" />
              )}
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
              variant="outline"
              onClick={() => handleDuplicate(mockup)}
              disabled={duplicating === mockup.id}
            >
              {duplicating === mockup.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
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
