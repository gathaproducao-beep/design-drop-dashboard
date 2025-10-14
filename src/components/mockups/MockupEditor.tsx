import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

interface MockupEditorProps {
  mockup: any;
  onClose: () => void;
  onSave: () => void;
}

interface Canvas {
  id: string;
  nome: string;
  imagem_base: string;
  ordem: number;
}

interface Area {
  id?: string;
  canvas_id: string;
  kind: "image" | "text";
  field_key: string;
  x: number;
  y: number;
  width: number;
  height: number;
  z_index: number;
  font_family?: string;
  font_size?: number;
  font_weight?: string;
  color?: string;
  text_align?: string;
  letter_spacing?: number;
  line_height?: number;
}

const TEXT_FIELDS = [
  { value: "numero_pedido", label: "Número do Pedido" },
  { value: "codigo_produto", label: "Código do Produto" },
  { value: "data_pedido", label: "Data do Pedido" },
  { value: "observacao", label: "Observação" },
];

export function MockupEditor({ mockup, onClose }: MockupEditorProps) {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [activeCanvas, setActiveCanvas] = useState<string>("");
  const [areas, setAreas] = useState<Area[]>([]);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [newArea, setNewArea] = useState<Partial<Area>>({
    kind: "image",
    field_key: "fotocliente[1]",
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    z_index: 1,
    font_family: "Arial",
    font_size: 16,
    font_weight: "normal",
    color: "#000000",
    text_align: "left",
    letter_spacing: 0,
    line_height: 1.2,
  });

  useEffect(() => {
    carregarCanvases();
  }, []);

  useEffect(() => {
    if (activeCanvas) {
      carregarAreas(activeCanvas);
    }
  }, [activeCanvas]);

  const carregarCanvases = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("mockup_canvases")
        .select("*")
        .eq("mockup_id", mockup.id)
        .order("ordem");

      if (error) throw error;
      setCanvases(data || []);
      if (data?.length > 0) setActiveCanvas(data[0].id);
    } catch (error) {
      toast.error("Erro ao carregar canvases");
    }
  };

  const carregarAreas = async (canvasId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from("mockup_areas")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("z_index");

      if (error) throw error;
      setAreas(data || []);
    } catch (error) {
      toast.error("Erro ao carregar áreas");
    }
  };

  const handleAddCanvas = async () => {
    const nome = prompt("Nome do canvas:");
    if (!nome) return;

    try {
      await (supabase as any).from("mockup_canvases").insert([
        { mockup_id: mockup.id, nome, imagem_base: "", ordem: canvases.length },
      ]);
      toast.success("Canvas adicionado");
      carregarCanvases();
    } catch (error) {
      toast.error("Erro ao adicionar canvas");
    }
  };

  const handleUploadCanvasImage = async (canvasId: string, file: File) => {
    setUploading(true);
    try {
      const fileName = `canvas-${canvasId}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("mockup-images")
        .upload(`mockups/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("mockup-images")
        .getPublicUrl(`mockups/${fileName}`);

      await (supabase as any)
        .from("mockup_canvases")
        .update({ imagem_base: urlData.publicUrl })
        .eq("id", canvasId);

      toast.success("Imagem atualizada");
      carregarCanvases();
    } catch (error) {
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleAddArea = async () => {
    if (!activeCanvas) return;

    try {
      await (supabase as any).from("mockup_areas").insert([
        { ...newArea, canvas_id: activeCanvas, mockup_id: mockup.id },
      ]);
      toast.success("Área adicionada");
      carregarAreas(activeCanvas);
    } catch (error) {
      toast.error("Erro ao adicionar área");
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    try {
      await (supabase as any).from("mockup_areas").delete().eq("id", areaId);
      toast.success("Área excluída");
      carregarAreas(activeCanvas);
    } catch (error) {
      toast.error("Erro ao excluir área");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <h2 className="text-2xl font-bold">{mockup.codigo_mockup}</h2>
        <Button onClick={handleAddCanvas}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Canvas
        </Button>
      </div>

      <Tabs value={activeCanvas} onValueChange={setActiveCanvas}>
        <TabsList>
          {canvases.map((c) => (
            <TabsTrigger key={c.id} value={c.id}>{c.nome}</TabsTrigger>
          ))}
        </TabsList>

        {canvases.map((canvas) => (
          <TabsContent key={canvas.id} value={canvas.id}>
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>{canvas.nome}</CardTitle>
                </CardHeader>
                <CardContent>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUploadCanvasImage(canvas.id, file);
                    }}
                    disabled={uploading}
                  />
                  {canvas.imagem_base && (
                    <img src={canvas.imagem_base} alt={canvas.nome} className="w-full mt-4" />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Nova Área</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <Select
                    value={newArea.kind}
                    onValueChange={(v: "image" | "text") => setNewArea({ ...newArea, kind: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">Imagem</SelectItem>
                      <SelectItem value="text">Texto</SelectItem>
                    </SelectContent>
                  </Select>

                  {newArea.kind === "image" ? (
                    <Select
                      value={newArea.field_key}
                      onValueChange={(v) => setNewArea({ ...newArea, field_key: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <SelectItem key={i} value={`fotocliente[${i}]`}>Foto {i}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select
                      value={newArea.field_key}
                      onValueChange={(v) => setNewArea({ ...newArea, field_key: v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {TEXT_FIELDS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    <Input type="number" placeholder="X" value={newArea.x} onChange={(e) => setNewArea({ ...newArea, x: +e.target.value })} />
                    <Input type="number" placeholder="Y" value={newArea.y} onChange={(e) => setNewArea({ ...newArea, y: +e.target.value })} />
                    <Input type="number" placeholder="Largura" value={newArea.width} onChange={(e) => setNewArea({ ...newArea, width: +e.target.value })} />
                    <Input type="number" placeholder="Altura" value={newArea.height} onChange={(e) => setNewArea({ ...newArea, height: +e.target.value })} />
                  </div>

                  <Button onClick={handleAddArea} className="w-full">
                    <Plus className="mr-2 h-4 w-4" />Adicionar
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card className="mt-4">
              <CardHeader><CardTitle>Áreas ({areas.length})</CardTitle></CardHeader>
              <CardContent>
                {areas.map((area) => (
                  <div key={area.id} className="flex justify-between p-2 border-b">
                    <span>{area.kind === "image" ? "📷" : "📝"} {area.field_key}</span>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteArea(area.id!)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
