import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical } from "lucide-react";

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
  const [dragging, setDragging] = useState<{ areaId: string; startX: number; startY: number } | null>(null);
  const [resizing, setResizing] = useState<{ areaId: string; startX: number; startY: number; startWidth: number; startHeight: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState<number>(1);
  
  const [showNewAreaForm, setShowNewAreaForm] = useState(false);
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

  // Calcular escala quando a imagem carregar
  useEffect(() => {
    const updateScale = () => {
      if (imageRef.current) {
        const naturalWidth = imageRef.current.naturalWidth;
        const renderedWidth = imageRef.current.width;
        const newScale = naturalWidth / renderedWidth;
        setScale(newScale);
        console.log(`Escala calculada: ${newScale} (Natural: ${naturalWidth}px, Renderizado: ${renderedWidth}px)`);
      }
    };

    const img = imageRef.current;
    if (img) {
      if (img.complete) {
        updateScale();
      } else {
        img.addEventListener('load', updateScale);
        return () => img.removeEventListener('load', updateScale);
      }
    }
  }, [activeCanvas, canvases]);

  // Funções de conversão de coordenadas
  const toRealCoordinates = (editorValue: number) => {
    return Math.round(editorValue * scale);
  };

  const toEditorCoordinates = (realValue: number) => {
    return Math.round(realValue / scale);
  };

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
      
      // Converter coordenadas do banco (real) para editor (escalado)
      const areasConvertidas = (data || []).map((area: Area) => ({
        ...area,
        x: toEditorCoordinates(area.x),
        y: toEditorCoordinates(area.y),
        width: toEditorCoordinates(area.width),
        height: toEditorCoordinates(area.height),
      }));
      
      setAreas(areasConvertidas);
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
      // Converter coordenadas do editor (escalado) para real antes de salvar
      const areaReal = {
        ...newArea,
        canvas_id: activeCanvas,
        mockup_id: mockup.id,
        x: toRealCoordinates(newArea.x || 0),
        y: toRealCoordinates(newArea.y || 0),
        width: toRealCoordinates(newArea.width || 0),
        height: toRealCoordinates(newArea.height || 0),
      };
      
      await (supabase as any).from("mockup_areas").insert([areaReal]);
      toast.success("Área adicionada");
      setShowNewAreaForm(false);
      carregarAreas(activeCanvas);
    } catch (error) {
      toast.error("Erro ao adicionar área");
    }
  };

  const handleUpdateArea = async (areaId: string, updates: Partial<Area>) => {
    try {
      // Converter coordenadas do editor (escalado) para real antes de salvar
      const updatesReal: Partial<Area> = { ...updates };
      if (updates.x !== undefined) updatesReal.x = toRealCoordinates(updates.x);
      if (updates.y !== undefined) updatesReal.y = toRealCoordinates(updates.y);
      if (updates.width !== undefined) updatesReal.width = toRealCoordinates(updates.width);
      if (updates.height !== undefined) updatesReal.height = toRealCoordinates(updates.height);
      
      await (supabase as any)
        .from("mockup_areas")
        .update(updatesReal)
        .eq("id", areaId);
      
      // Atualizar estado local com valores do editor (escalado)
      setAreas(prev => prev.map(a => a.id === areaId ? { ...a, ...updates } : a));
    } catch (error) {
      toast.error("Erro ao atualizar área");
    }
  };

  const handleMouseDown = (e: React.MouseEvent, areaId: string, isResize = false) => {
    e.stopPropagation();
    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    if (isResize) {
      setResizing({
        areaId,
        startX: e.clientX,
        startY: e.clientY,
        startWidth: area.width,
        startHeight: area.height,
      });
    } else {
      setDragging({
        areaId,
        startX: e.clientX,
        startY: e.clientY,
      });
    }
    setSelectedArea(areaId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragging) {
      const area = areas.find(a => a.id === dragging.areaId);
      if (!area || !canvasRef.current) return;

      const deltaX = e.clientX - dragging.startX;
      const deltaY = e.clientY - dragging.startY;

      const newX = Math.max(0, area.x + deltaX);
      const newY = Math.max(0, area.y + deltaY);

      setAreas(prev => prev.map(a => 
        a.id === dragging.areaId ? { ...a, x: newX, y: newY } : a
      ));

      setDragging({ ...dragging, startX: e.clientX, startY: e.clientY });
    } else if (resizing) {
      const area = areas.find(a => a.id === resizing.areaId);
      if (!area) return;

      const deltaX = e.clientX - resizing.startX;
      const deltaY = e.clientY - resizing.startY;

      const newWidth = Math.max(20, resizing.startWidth + deltaX);
      const newHeight = Math.max(20, resizing.startHeight + deltaY);

      setAreas(prev => prev.map(a => 
        a.id === resizing.areaId ? { ...a, width: newWidth, height: newHeight } : a
      ));
    }
  };

  const handleMouseUp = () => {
    if (dragging) {
      const area = areas.find(a => a.id === dragging.areaId);
      if (area) {
        handleUpdateArea(area.id!, { x: area.x, y: area.y });
      }
      setDragging(null);
    } else if (resizing) {
      const area = areas.find(a => a.id === resizing.areaId);
      if (area) {
        handleUpdateArea(area.id!, { width: area.width, height: area.height });
      }
      setResizing(null);
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
            <div className="grid grid-cols-[1fr_400px] gap-6">
              {/* Visual Canvas Editor */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{canvas.nome}</CardTitle>
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadCanvasImage(canvas.id, file);
                      }}
                      disabled={uploading}
                      className="max-w-[200px]"
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  {canvas.imagem_base ? (
                    <div 
                      ref={canvasRef}
                      className="relative border border-border rounded-lg overflow-hidden bg-muted"
                      style={{ cursor: dragging || resizing ? 'grabbing' : 'default' }}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      onMouseLeave={handleMouseUp}
                    >
                      <img 
                        ref={imageRef}
                        src={canvas.imagem_base} 
                        alt={canvas.nome} 
                        className="w-full h-auto block"
                        draggable={false}
                      />
                      
                      {/* Áreas sobrepostas */}
                      {areas.map((area) => (
                        <div
                          key={area.id}
                          className={`absolute border-2 ${
                            selectedArea === area.id 
                              ? 'border-primary bg-primary/10' 
                              : 'border-blue-500 bg-blue-500/20'
                          } cursor-move transition-all`}
                          style={{
                            left: `${area.x}px`,
                            top: `${area.y}px`,
                            width: `${area.width}px`,
                            height: `${area.height}px`,
                            zIndex: area.z_index,
                          }}
                          onMouseDown={(e) => handleMouseDown(e, area.id!, false)}
                        >
                          {/* Label da área */}
                          <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-1">
                            {area.kind === "image" ? "📷" : "📝"} {area.field_key}
                          </div>

                          {/* Grip para mover */}
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <GripVertical className="w-6 h-6 text-primary" />
                          </div>

                          {/* Handle de redimensionamento */}
                          <div
                            className="absolute bottom-0 right-0 w-4 h-4 bg-primary cursor-nwse-resize"
                            onMouseDown={(e) => handleMouseDown(e, area.id!, true)}
                          />

                          {/* Botão de deletar */}
                          <Button
                            variant="destructive"
                            size="icon"
                            className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteArea(area.id!);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-muted-foreground py-12">
                      Nenhum arquivo selecionado.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sidebar de controle */}
              <div className="space-y-4">
                {!showNewAreaForm ? (
                  <Button 
                    onClick={() => setShowNewAreaForm(true)} 
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Nova Área
                  </Button>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Nova Área</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <Label>Tipo</Label>
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
                      </div>

                      <div>
                        <Label>Campo</Label>
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
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">X</Label>
                          <Input 
                            type="number" 
                            value={newArea.x} 
                            onChange={(e) => setNewArea({ ...newArea, x: +e.target.value })} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Y</Label>
                          <Input 
                            type="number" 
                            value={newArea.y} 
                            onChange={(e) => setNewArea({ ...newArea, y: +e.target.value })} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Largura</Label>
                          <Input 
                            type="number" 
                            value={newArea.width} 
                            onChange={(e) => setNewArea({ ...newArea, width: +e.target.value })} 
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Altura</Label>
                          <Input 
                            type="number" 
                            value={newArea.height} 
                            onChange={(e) => setNewArea({ ...newArea, height: +e.target.value })} 
                          />
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <Button onClick={handleAddArea} className="flex-1">
                          <Plus className="mr-2 h-4 w-4" />Adicionar
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowNewAreaForm(false)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Áreas ({areas.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {areas.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma área adicionada
                      </p>
                    ) : (
                      areas.map((area) => (
                        <div 
                          key={area.id} 
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            selectedArea === area.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-accent'
                          }`}
                          onClick={() => setSelectedArea(area.id!)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">
                              {area.kind === "image" ? "📷" : "📝"}
                            </span>
                            <div className="text-sm">
                              <div className="font-medium">{area.field_key}</div>
                              <div className="text-xs text-muted-foreground">
                                {area.x}x{area.y} • {area.width}x{area.height}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
