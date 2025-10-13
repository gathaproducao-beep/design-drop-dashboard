import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MockupEditorProps {
  mockup: any;
  onClose: () => void;
  onSave: () => void;
}

interface Area {
  id?: string;
  field_key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
}

export function MockupEditor({ mockup, onClose, onSave }: MockupEditorProps) {
  const [areas, setAreas] = useState<Area[]>(mockup.mockup_areas || []);
  const [selectedArea, setSelectedArea] = useState<number | null>(null);
  const [newArea, setNewArea] = useState<Partial<Area>>({
    field_key: "fotocliente",
    x: 50,
    y: 50,
    width: 100,
    height: 100,
    z_index: 1,
  });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = mockup.imagem_base;
  }, [mockup.imagem_base]);

  const handleAddArea = async () => {
    try {
      const { data, error } = await supabase
        .from("mockup_areas")
        .insert([
          {
            mockup_id: mockup.id,
            field_key: newArea.field_key || "fotocliente",
            x: newArea.x || 50,
            y: newArea.y || 50,
            width: newArea.width || 100,
            height: newArea.height || 100,
            z_index: newArea.z_index || 1,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      setAreas([...areas, data]);
      toast.success("Área adicionada");
    } catch (error) {
      console.error("Erro ao adicionar área:", error);
      toast.error("Erro ao adicionar área");
    }
  };

  const handleDeleteArea = async (index: number) => {
    const area = areas[index];
    if (area.id) {
      try {
        const { error } = await supabase
          .from("mockup_areas")
          .delete()
          .eq("id", area.id);

        if (error) throw error;
      } catch (error) {
        console.error("Erro ao excluir área:", error);
        toast.error("Erro ao excluir área");
        return;
      }
    }

    setAreas(areas.filter((_, i) => i !== index));
    toast.success("Área removida");
  };

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    setSelectedArea(index);
    setDragging(true);
    setDragStart({
      x: e.clientX - areas[index].x,
      y: e.clientY - areas[index].y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging && selectedArea !== null && canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const newX = Math.max(0, Math.min(rect.width - areas[selectedArea].width, e.clientX - rect.left - dragStart.x));
      const newY = Math.max(0, Math.min(rect.height - areas[selectedArea].height, e.clientY - rect.top - dragStart.y));

      const updatedAreas = [...areas];
      updatedAreas[selectedArea] = {
        ...updatedAreas[selectedArea],
        x: newX,
        y: newY,
      };
      setAreas(updatedAreas);
    }
  };

  const handleMouseUp = async () => {
    if (dragging && selectedArea !== null) {
      const area = areas[selectedArea];
      if (area.id) {
        try {
          const { error } = await supabase
            .from("mockup_areas")
            .update({ x: area.x, y: area.y })
            .eq("id", area.id);

          if (error) throw error;
        } catch (error) {
          console.error("Erro ao atualizar posição:", error);
        }
      }
    }
    setDragging(false);
    setResizing(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold">{mockup.codigo_mockup}</h2>
        <Button onClick={onSave} className="bg-gradient-to-r from-primary to-primary/80">
          <Save className="mr-2 h-4 w-4" />
          Salvar
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Canvas de Edição</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                ref={canvasRef}
                className="relative w-full bg-muted rounded-lg overflow-hidden"
                style={{ aspectRatio: imageSize.width / imageSize.height || 1 }}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={mockup.imagem_base}
                  alt="Mockup base"
                  className="w-full h-full object-contain pointer-events-none"
                  draggable={false}
                />
                {areas.map((area, index) => (
                  <div
                    key={index}
                    className={`absolute border-2 cursor-move transition-colors ${
                      selectedArea === index
                        ? "border-primary bg-primary/20"
                        : "border-accent bg-accent/10"
                    }`}
                    style={{
                      left: `${area.x}px`,
                      top: `${area.y}px`,
                      width: `${area.width}px`,
                      height: `${area.height}px`,
                      zIndex: area.z_index,
                    }}
                    onMouseDown={(e) => handleMouseDown(index, e)}
                  >
                    <div className="absolute -top-6 left-0 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      {area.field_key}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nova Área</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Campo (field_key)</Label>
                <Input
                  value={newArea.field_key}
                  onChange={(e) =>
                    setNewArea({ ...newArea, field_key: e.target.value })
                  }
                  placeholder="fotocliente"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>X</Label>
                  <Input
                    type="number"
                    value={newArea.x}
                    onChange={(e) =>
                      setNewArea({ ...newArea, x: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Y</Label>
                  <Input
                    type="number"
                    value={newArea.y}
                    onChange={(e) =>
                      setNewArea({ ...newArea, y: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Largura</Label>
                  <Input
                    type="number"
                    value={newArea.width}
                    onChange={(e) =>
                      setNewArea({ ...newArea, width: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Altura</Label>
                  <Input
                    type="number"
                    value={newArea.height}
                    onChange={(e) =>
                      setNewArea({ ...newArea, height: Number(e.target.value) })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Z-Index</Label>
                <Input
                  type="number"
                  value={newArea.z_index}
                  onChange={(e) =>
                    setNewArea({ ...newArea, z_index: Number(e.target.value) })
                  }
                />
              </div>
              <Button onClick={handleAddArea} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Área
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Áreas Definidas ({areas.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {areas.map((area, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-2 cursor-pointer transition-colors ${
                      selectedArea === index
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground"
                    }`}
                    onClick={() => setSelectedArea(index)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm">{area.field_key}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteArea(index);
                        }}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground grid grid-cols-2 gap-1">
                      <span>X: {area.x}px</span>
                      <span>Y: {area.y}px</span>
                      <span>W: {area.width}px</span>
                      <span>H: {area.height}px</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
