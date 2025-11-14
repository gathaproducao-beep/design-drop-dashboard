import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, Edit, Copy } from "lucide-react";

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
  rotation?: number;
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

export function MockupEditor({ mockup, onClose, onSave }: MockupEditorProps) {
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
  
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [showNewAreaForm, setShowNewAreaForm] = useState(false);
  const [newArea, setNewArea] = useState<Partial<Area>>({
    kind: "image",
    field_key: "fotocliente[1]",
    x: 50,
    y: 50,
    width: 200,
    height: 200,
    z_index: 1,
    rotation: 0,
    font_family: "Arial",
    font_size: 16,
    font_weight: "normal",
    color: "#000000",
    text_align: "left",
    letter_spacing: 0,
    line_height: 1.2,
  });

  const [mockupInfo, setMockupInfo] = useState({
    codigo_mockup: mockup.codigo_mockup,
    mockup_aprovacao_vinculado_id: mockup.mockup_aprovacao_vinculado_id
  });
  const [mockupsAprovacao, setMockupsAprovacao] = useState<any[]>([]);

  useEffect(() => {
    carregarCanvases();
    if (mockup.tipo === "molde") {
      carregarMockupsAprovacao();
    }
  }, []);

  useEffect(() => {
    // Só carregar áreas se activeCanvas E scale estiverem prontos
    if (activeCanvas && scale > 1) {
      console.log(`[useEffect] Carregando áreas com escala: ${scale}`);
      carregarAreas(activeCanvas);
    }
  }, [activeCanvas, scale]); // Adicionar scale como dependência

  // Calcular escala quando a imagem carregar
  useEffect(() => {
    const updateScale = () => {
      if (imageRef.current) {
        const naturalWidth = imageRef.current.naturalWidth;
        const renderedWidth = imageRef.current.width;
        const newScale = naturalWidth / renderedWidth;
        setScale(newScale);
        console.log(`[Scale] Scale anterior: ${scale}, novo scale: ${newScale}`);
        console.log(`[Scale] Escala calculada: ${newScale} (Natural: ${naturalWidth}px, Renderizado: ${renderedWidth}px)`);
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

  const carregarMockupsAprovacao = async () => {
    try {
      const { data, error } = await supabase
        .from("mockups")
        .select("id, codigo_mockup")
        .eq("tipo", "aprovacao")
        .order("codigo_mockup");
      
      if (error) throw error;
      setMockupsAprovacao(data || []);
    } catch (error) {
      console.error("Erro ao carregar mockups de aprovação:", error);
    }
  };

  const handleUpdateMockupInfo = async () => {
    try {
      const { error } = await supabase
        .from("mockups")
        .update({
          codigo_mockup: mockupInfo.codigo_mockup,
          mockup_aprovacao_vinculado_id: mockupInfo.mockup_aprovacao_vinculado_id
        })
        .eq("id", mockup.id);
      
      if (error) throw error;
      toast.success("Informações atualizadas");
      onSave();
    } catch (error) {
      console.error("Erro ao atualizar informações:", error);
      toast.error("Erro ao atualizar informações");
    }
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
    console.log(`[carregarAreas] Iniciando com scale: ${scale}`);
    try {
      const { data, error } = await (supabase as any)
        .from("mockup_areas")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("z_index");

      if (error) throw error;
      
      console.log(`[carregarAreas] Áreas do banco (real):`, data?.map(a => ({ 
        id: a.id.substring(0, 8), 
        x: a.x, 
        y: a.y, 
        w: a.width, 
        h: a.height 
      })));
      
      // Converter coordenadas do banco (real) para editor (escalado)
      const areasConvertidas = (data || []).map((area: Area) => ({
        ...area,
        x: toEditorCoordinates(area.x),
        y: toEditorCoordinates(area.y),
        width: toEditorCoordinates(area.width),
        height: toEditorCoordinates(area.height),
      }));
      
      console.log(`[carregarAreas] Áreas convertidas (editor):`, areasConvertidas.map(a => ({ 
        id: a.id?.substring(0, 8), 
        x: a.x, 
        y: a.y, 
        w: a.width, 
        h: a.height 
      })));
      
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

  const handleEditArea = (area: Area) => {
    setEditingArea(area);
    setNewArea({
      kind: area.kind,
      field_key: area.field_key,
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      z_index: area.z_index,
      rotation: area.rotation || 0,
      font_family: area.font_family,
      font_size: area.font_size,
      font_weight: area.font_weight,
      color: area.color,
      text_align: area.text_align,
      letter_spacing: area.letter_spacing,
      line_height: area.line_height,
    });
    setShowNewAreaForm(true);
  };

  const handleSaveEditArea = async () => {
    if (!editingArea?.id) return;

    try {
      console.log(`[handleSaveEditArea] Valores do formulário (editor):`, {
        x: newArea.x,
        y: newArea.y,
        w: newArea.width,
        h: newArea.height,
      });
      
      // Converter coordenadas do editor para real APENAS UMA VEZ
      const updates = {
        kind: newArea.kind,
        field_key: newArea.field_key,
        x: toRealCoordinates(newArea.x!),
        y: toRealCoordinates(newArea.y!),
        width: toRealCoordinates(newArea.width!),
        height: toRealCoordinates(newArea.height!),
        z_index: newArea.z_index,
        rotation: newArea.rotation,
        font_family: newArea.font_family,
        font_size: newArea.font_size,
        font_weight: newArea.font_weight,
        color: newArea.color,
        text_align: newArea.text_align,
        letter_spacing: newArea.letter_spacing,
        line_height: newArea.line_height,
      };
      
      console.log(`[handleSaveEditArea] Valores a salvar (real):`, {
        x: updates.x,
        y: updates.y,
        w: updates.width,
        h: updates.height,
      });
      console.log(`[handleSaveEditArea] Scale usado: ${scale}`);
      
      // Salvar DIRETAMENTE no banco (não usar handleUpdateArea para evitar dupla conversão)
      const { error } = await supabase
        .from("mockup_areas")
        .update(updates)
        .eq("id", editingArea.id);
      
      if (error) throw error;
      
      toast.success("Área atualizada");
      handleCancelForm();
      carregarAreas(activeCanvas!); // Recarregar do banco com conversão correta
    } catch (error) {
      console.error("Erro ao atualizar área:", error);
      toast.error("Erro ao atualizar área");
    }
  };

  const handleDuplicateArea = async (area: Area) => {
    if (!activeCanvas) return;

    try {
      console.log(`[handleDuplicateArea] Área original (editor):`, {
        x: area.x,
        y: area.y,
        w: area.width,
        h: area.height,
      });
      
      const areaDuplicada = {
        canvas_id: activeCanvas,
        mockup_id: mockup.id,
        kind: area.kind,
        field_key: area.field_key,
        x: toRealCoordinates(area.x + 20),
        y: toRealCoordinates(area.y + 20),
        width: toRealCoordinates(area.width),
        height: toRealCoordinates(area.height),
        z_index: area.z_index,
        rotation: area.rotation || 0,
        font_family: area.font_family,
        font_size: area.font_size,
        font_weight: area.font_weight,
        color: area.color,
        text_align: area.text_align,
        letter_spacing: area.letter_spacing,
        line_height: area.line_height,
      };
      
      console.log(`[handleDuplicateArea] Área duplicada (real):`, {
        x: areaDuplicada.x,
        y: areaDuplicada.y,
        w: areaDuplicada.width,
        h: areaDuplicada.height,
      });
      console.log(`[handleDuplicateArea] Scale usado: ${scale}`);
      
      await (supabase as any).from("mockup_areas").insert([areaDuplicada]);
      toast.success("Área duplicada");
      carregarAreas(activeCanvas);
    } catch (error) {
      console.error("Erro ao duplicar área:", error);
      toast.error("Erro ao duplicar área");
    }
  };

  const handleCancelForm = () => {
    setShowNewAreaForm(false);
    setEditingArea(null);
    setNewArea({
      kind: "image",
      field_key: "fotocliente[1]",
      x: 50,
      y: 50,
      width: 200,
      height: 200,
      z_index: 1,
      rotation: 0,
      font_family: "Arial",
      font_size: 16,
      font_weight: "normal",
      color: "#000000",
      text_align: "left",
      letter_spacing: 0,
      line_height: 1.2,
    });
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

      {/* Informações do Mockup */}
      <Card>
        <CardHeader>
          <CardTitle>Informações do Mockup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Código do Mockup</Label>
            <Input
              value={mockupInfo.codigo_mockup}
              onChange={(e) => setMockupInfo({ ...mockupInfo, codigo_mockup: e.target.value })}
              placeholder="Ex: PIMASC-1364"
            />
          </div>
          
          {mockup.tipo === "molde" && (
            <div>
              <Label>Mockup de Aprovação Vinculado</Label>
              <Select
                value={mockupInfo.mockup_aprovacao_vinculado_id || ""}
                onValueChange={(v) => setMockupInfo({ ...mockupInfo, mockup_aprovacao_vinculado_id: v || null })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mockup de aprovação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {mockupsAprovacao.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.codigo_mockup}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleUpdateMockupInfo}>
            Salvar Alterações
          </Button>
        </CardContent>
      </Card>

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
                            transform: `rotate(${area.rotation || 0}deg)`,
                            transformOrigin: 'center',
                          }}
                          onMouseDown={(e) => handleMouseDown(e, area.id!, false)}
                        >
                          {/* Label da área */}
                          <div className="absolute -top-6 left-0 bg-primary text-primary-foreground text-xs px-2 py-1 rounded whitespace-nowrap flex items-center gap-1">
                            {area.kind === "image" ? "📷" : "📝"} 
                            {area.kind === "text" 
                              ? TEXT_FIELDS.find(f => f.value === area.field_key)?.label || area.field_key
                              : area.field_key}
                          </div>

                          {/* Preview de texto */}
                          {area.kind === "text" && (
                            <div 
                              className="absolute inset-0 flex items-center justify-center p-2 pointer-events-none overflow-hidden"
                              style={{
                                fontFamily: area.font_family,
                                fontSize: `${(area.font_size || 16) / scale}px`,
                                fontWeight: area.font_weight,
                                color: area.color,
                                textAlign: area.text_align as any,
                                letterSpacing: `${(area.letter_spacing || 0) / scale}px`,
                                lineHeight: area.line_height
                              }}
                            >
                              <span className="opacity-50">
                                {TEXT_FIELDS.find(f => f.value === area.field_key)?.label}
                              </span>
                            </div>
                          )}

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
                  <CardTitle className="text-base">
                    {editingArea ? "Editar Área" : "Nova Área"}
                  </CardTitle>
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
                        {newArea.kind === "image" ? (
                          <>
                            <Label>Campo</Label>
                            <Select
                              value={newArea.field_key}
                              onValueChange={(v) => setNewArea({ ...newArea, field_key: v })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <SelectItem key={i} value={`fotocliente[${i}]`}>
                                    Foto do Cliente {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        ) : (
                          <>
                            <Label>Texto Variável</Label>
                            <p className="text-xs text-muted-foreground mb-2">
                              Escolha qual informação do pedido será exibida nesta área
                            </p>
                            <Select
                              value={newArea.field_key}
                              onValueChange={(v) => setNewArea({ ...newArea, field_key: v })}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {TEXT_FIELDS.map((field) => (
                                  <SelectItem key={field.value} value={field.value}>
                                    {field.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </>
                        )}
                      </div>

                      {newArea.kind === "text" && (
                        <>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Fonte</Label>
                              <Select
                                value={newArea.font_family}
                                onValueChange={(v) => setNewArea({ ...newArea, font_family: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Arial">Arial</SelectItem>
                                  <SelectItem value="Times New Roman">Times New Roman</SelectItem>
                                  <SelectItem value="Courier New">Courier New</SelectItem>
                                  <SelectItem value="Georgia">Georgia</SelectItem>
                                  <SelectItem value="Verdana">Verdana</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label>Tamanho (px)</Label>
                              <Input
                                type="number"
                                value={newArea.font_size}
                                onChange={(e) => setNewArea({ ...newArea, font_size: parseInt(e.target.value) })}
                                min="8"
                                max="200"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Peso</Label>
                              <Select
                                value={newArea.font_weight}
                                onValueChange={(v) => setNewArea({ ...newArea, font_weight: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="normal">Normal</SelectItem>
                                  <SelectItem value="bold">Negrito</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div>
                              <Label>Alinhamento</Label>
                              <Select
                                value={newArea.text_align}
                                onValueChange={(v) => setNewArea({ ...newArea, text_align: v })}
                              >
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="left">Esquerda</SelectItem>
                                  <SelectItem value="center">Centro</SelectItem>
                                  <SelectItem value="right">Direita</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div>
                            <Label>Cor</Label>
                            <div className="flex gap-2">
                              <Input
                                type="color"
                                value={newArea.color}
                                onChange={(e) => setNewArea({ ...newArea, color: e.target.value })}
                                className="w-20"
                              />
                              <Input
                                type="text"
                                value={newArea.color}
                                onChange={(e) => setNewArea({ ...newArea, color: e.target.value })}
                                placeholder="#000000"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <Label>Espaçamento</Label>
                              <Input
                                type="number"
                                value={newArea.letter_spacing}
                                onChange={(e) => setNewArea({ ...newArea, letter_spacing: parseFloat(e.target.value) })}
                                step="0.1"
                              />
                            </div>
                            
                            <div>
                              <Label>Altura de Linha</Label>
                              <Input
                                type="number"
                                value={newArea.line_height}
                                onChange={(e) => setNewArea({ ...newArea, line_height: parseFloat(e.target.value) })}
                                step="0.1"
                                min="0.5"
                                max="3"
                              />
                            </div>
                          </div>
                        </>
                      )}

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

                      <div>
                        <Label className="text-xs">Rotação (graus)</Label>
                        <div className="flex gap-2 items-center">
                          <Input 
                            type="number" 
                            value={newArea.rotation || 0} 
                            onChange={(e) => setNewArea({ ...newArea, rotation: +e.target.value })} 
                            min="0"
                            max="360"
                            step="1"
                          />
                          <span className="text-xs text-muted-foreground">{newArea.rotation || 0}°</span>
                        </div>
                      </div>

                      <div className="flex gap-2">
                        {editingArea ? (
                          <Button onClick={handleSaveEditArea} className="flex-1">
                            <Plus className="mr-2 h-4 w-4" />
                            Salvar Alterações
                          </Button>
                        ) : (
                          <Button onClick={handleAddArea} className="flex-1">
                            <Plus className="mr-2 h-4 w-4" />
                            Adicionar Área
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          onClick={handleCancelForm}
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
                          className={`flex items-center justify-between p-3 rounded-lg border ${
                            selectedArea === area.id 
                              ? 'border-primary bg-primary/5' 
                              : 'border-border hover:bg-accent'
                          }`}
                        >
                          <div 
                            className="flex items-center gap-2 flex-1 cursor-pointer"
                            onClick={() => setSelectedArea(area.id!)}
                          >
                            <span className="text-lg">
                              {area.kind === "image" ? "📷" : "📝"}
                            </span>
                            <div className="text-sm">
                              <div className="font-medium">
                                {area.kind === "text" 
                                  ? TEXT_FIELDS.find(f => f.value === area.field_key)?.label 
                                  : area.field_key
                                }
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {Math.round(area.x)}x{Math.round(area.y)} • {Math.round(area.width)}x{Math.round(area.height)}
                                {area.rotation ? ` • ${area.rotation}°` : ''}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditArea(area);
                              }}
                              title="Editar área"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDuplicateArea(area);
                              }}
                              title="Duplicar área"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteArea(area.id!);
                              }}
                              title="Excluir área"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
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
