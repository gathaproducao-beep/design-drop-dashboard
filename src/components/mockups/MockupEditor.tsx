import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, GripVertical, Edit, Copy, Save, Download, RefreshCw } from "lucide-react";
import { SalvarTemplateDialog } from "@/components/templates/SalvarTemplateDialog";
import { AplicarTemplateDialog } from "@/components/templates/AplicarTemplateDialog";

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
  largura_original?: number;
  altura_original?: number;
  escala_calculada?: number;
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
  const [scaleReady, setScaleReady] = useState(false);
  const [canvasScales, setCanvasScales] = useState<Record<string, number>>({});
  
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
  
  const [salvarTemplateOpen, setSalvarTemplateOpen] = useState(false);
  const [aplicarTemplateOpen, setAplicarTemplateOpen] = useState(false);

  useEffect(() => {
    carregarCanvases();
    if (mockup.tipo === "molde") {
      carregarMockupsAprovacao();
    }
  }, []);

  useEffect(() => {
    // Carregar áreas SOMENTE quando activeCanvas estiver pronto E escala tiver sido calculada
    if (activeCanvas && scaleReady && scale > 0) {
      console.log(`[useEffect] Carregando áreas para canvas ${activeCanvas} com escala: ${scale}`);
      carregarAreas(activeCanvas);
    }
  }, [activeCanvas, scaleReady]);

  // Calcular escala quando a imagem carregar OU usar escala salva no banco
  useEffect(() => {
    setScaleReady(false);
    setAreas([]);
    
    const updateScale = async () => {
      if (!imageRef.current || !imageRef.current.complete || imageRef.current.naturalWidth === 0) {
        return;
      }

      const canvas = canvases.find(c => c.id === activeCanvas);
      if (!canvas) return;

      const naturalWidth = imageRef.current.naturalWidth;
      const naturalHeight = imageRef.current.naturalHeight;
      const renderedWidth = imageRef.current.width;

      // SEMPRE usar escala do banco se existir - NUNCA recalcular
      if (canvas.escala_calculada) {
        const scaleDoBanco = canvas.escala_calculada;
        
        console.log(`[Scale] ✅ Canvas: ${canvas.nome} - USANDO ESCALA DO BANCO`);
        console.log(`  - Escala salva: ${scaleDoBanco}`);
        console.log(`  - Natural atual: ${naturalWidth}px`);
        console.log(`  - Rendered atual: ${renderedWidth}px`);
        
        setCanvasScales(prev => ({ ...prev, [activeCanvas]: scaleDoBanco }));
        setScale(scaleDoBanco);
        setScaleReady(true);
      } else {
        // CANVAS ANTIGO sem escala - calcular UMA vez baseado em 800px e salvar
        const newScale = naturalWidth / 800;
        
        console.log(`[Scale] 🆕 Canvas: ${canvas.nome} - CALCULANDO PRIMEIRA VEZ (canvas antigo)`);
        console.log(`  - Natural: ${naturalWidth}px`);
        console.log(`  - Scale calculada: ${newScale} (baseado em 800px)`);
        
        try {
          await (supabase as any)
            .from("mockup_canvases")
            .update({
              largura_original: naturalWidth,
              altura_original: naturalHeight,
              escala_calculada: newScale
            })
            .eq("id", activeCanvas);
          
          console.log(`  - ✓ Escala salva no banco`);
        } catch (error) {
          console.error("Erro ao salvar escala:", error);
        }
        
        setCanvasScales(prev => ({ ...prev, [activeCanvas]: newScale }));
        setScale(newScale);
        setScaleReady(true);
      }
    };

    const img = imageRef.current;
    if (img) {
      if (img.complete && img.naturalWidth > 0) {
        updateScale();
      } else {
        img.addEventListener('load', updateScale);
        const timeout = setTimeout(updateScale, 1000);
        return () => {
          img.removeEventListener('load', updateScale);
          clearTimeout(timeout);
        };
      }
    }
  }, [activeCanvas, canvases]);

  // Funções de conversão de coordenadas
  const toRealCoordinates = (editorValue: number) => {
    if (!scaleReady) {
      console.error("[toRealCoordinates] ❌ Tentando converter sem escala pronta!");
      return editorValue;
    }
    // Usar escala específica do canvas ativo
    const scaleToUse = canvasScales[activeCanvas] || scale;
    const canvas = canvases.find(c => c.id === activeCanvas);
    const result = Math.round(editorValue * scaleToUse);
    console.log(`[toReal] Canvas:${canvas?.nome} Editor:${editorValue} * Scale:${scaleToUse.toFixed(3)} = Real:${result}`);
    return result;
  };

  const toEditorCoordinates = (realValue: number) => {
    if (!scaleReady) {
      console.error("[toEditorCoordinates] ❌ Tentando converter sem escala pronta!");
      return realValue;
    }
    // Usar escala específica do canvas ativo
    const scaleToUse = canvasScales[activeCanvas] || scale;
    const canvas = canvases.find(c => c.id === activeCanvas);
    const result = Math.round(realValue / scaleToUse);
    console.log(`[toEditor] Canvas:${canvas?.nome} Real:${realValue} / Scale:${scaleToUse.toFixed(3)} = Editor:${result}`);
    return result;
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
      if (data?.length > 0 && !activeCanvas) {
        setActiveCanvas(data[0].id);
      }
    } catch (error) {
      toast.error("Erro ao carregar canvases");
    }
  };

  const carregarAreas = async (canvasId: string) => {
    if (!scaleReady || scale <= 0) {
      console.warn(`[carregarAreas] ⚠️ Escala não pronta para canvas ${canvasId} (scale: ${scale}, ready: ${scaleReady})`);
      setAreas([]);
      return;
    }

    const canvas = canvases.find(c => c.id === canvasId);
    const scaleToUse = canvasScales[canvasId] || scale;
    console.log(`[carregarAreas] ✅ Canvas: ${canvas?.nome}`);
    console.log(`  - Scale atual: ${scale.toFixed(3)}`);
    console.log(`  - Scale armazenada para este canvas: ${canvasScales[canvasId]?.toFixed(3) || 'N/A'}`);
    console.log(`  - Scale que será usada: ${scaleToUse.toFixed(3)}`);
    
    try {
      const { data, error } = await (supabase as any)
        .from("mockup_areas")
        .select("*")
        .eq("canvas_id", canvasId)
        .order("z_index");

      if (error) throw error;
      
      console.log(`[carregarAreas] Áreas do banco (coordenadas reais):`, data?.map(a => ({ 
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
      
      console.log(`[carregarAreas] Áreas convertidas para editor (escala ${scale.toFixed(3)}):`, areasConvertidas.map(a => ({ 
        id: a.id?.substring(0, 8), 
        x: a.x, 
        y: a.y, 
        w: a.width, 
        h: a.height 
      })));
      
      setAreas(areasConvertidas);
    } catch (error) {
      console.error('[carregarAreas] Erro:', error);
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

  const handleDeleteCanvas = async (canvasId: string) => {
    if (canvases.length <= 1) {
      toast.error("Não é possível excluir o último canvas");
      return;
    }

    const canvas = canvases.find(c => c.id === canvasId);
    if (!confirm(`Tem certeza que deseja excluir o canvas "${canvas?.nome}"? Todas as áreas vinculadas serão excluídas também.`)) {
      return;
    }

    try {
      // Primeiro, excluir todas as áreas do canvas
      await supabase
        .from("mockup_areas")
        .delete()
        .eq("canvas_id", canvasId);
      
      // Depois, excluir o canvas
      await supabase
        .from("mockup_canvases")
        .delete()
        .eq("id", canvasId);
      
      toast.success("Canvas excluído com sucesso");
      
      // Se o canvas excluído era o ativo, mudar para o primeiro disponível
      if (activeCanvas === canvasId) {
        const remainingCanvases = canvases.filter(c => c.id !== canvasId);
        if (remainingCanvases.length > 0) {
          setActiveCanvas(remainingCanvases[0].id);
        }
      }
      
      // Recarregar mockup
      carregarCanvases();
      onSave();
    } catch (error) {
      console.error("Erro ao excluir canvas:", error);
      toast.error("Erro ao excluir canvas");
    }
  };

  const handleRecalcularEscala = async (canvasId: string) => {
    const canvas = canvases.find(c => c.id === canvasId);
    if (!canvas?.largura_original) {
      toast.error("Canvas não tem dimensões originais salvas");
      return;
    }
    
    // Recalcular com base em largura fixa de 800px
    const novaEscala = canvas.largura_original / 800;
    
    try {
      await (supabase as any)
        .from("mockup_canvases")
        .update({ escala_calculada: novaEscala })
        .eq("id", canvasId);
      
      toast.success(`Escala recalculada: ${novaEscala.toFixed(2)}`);
      carregarCanvases();
    } catch (error) {
      console.error("Erro ao recalcular escala:", error);
      toast.error("Erro ao recalcular escala");
    }
  };

  const handleUploadCanvasImage = async (canvasId: string, file: File) => {
    setUploading(true);
    try {
      // 1. Ler dimensões originais da imagem
      const img = new Image();
      const imageUrl = URL.createObjectURL(file);
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imageUrl;
      });

      const larguraOriginal = img.naturalWidth;
      const alturaOriginal = img.naturalHeight;
      
      console.log(`[Upload Canvas] Dimensões originais: ${larguraOriginal}x${alturaOriginal}px`);
      
      URL.revokeObjectURL(imageUrl);

      // 2. Upload da imagem
      const fileName = `canvas-${canvasId}-${Date.now()}.${file.name.split(".").pop()}`;
      const { error: uploadError } = await supabase.storage
        .from("mockup-images")
        .upload(`mockups/${fileName}`, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("mockup-images")
        .getPublicUrl(`mockups/${fileName}`);

      // 3. Calcular escala com base em largura fixa de 800px
      const escalaCalculada = larguraOriginal / 800;
      
      console.log(`[Upload Canvas] Escala calculada: ${escalaCalculada}`);
      
      await (supabase as any)
        .from("mockup_canvases")
        .update({ 
          imagem_base: urlData.publicUrl,
          largura_original: larguraOriginal,
          altura_original: alturaOriginal,
          escala_calculada: escalaCalculada
        })
        .eq("id", canvasId);

      toast.success("Imagem atualizada");
      carregarCanvases();
    } catch (error) {
      console.error("Erro no upload:", error);
      toast.error("Erro ao fazer upload");
    } finally {
      setUploading(false);
    }
  };

  const handleAddArea = async () => {
    if (!scaleReady) {
      toast.error("⚠️ Aguarde a imagem carregar completamente antes de adicionar áreas");
      return;
    }
    if (!activeCanvas) return;

    const canvas = canvases.find(c => c.id === activeCanvas);
    console.log(`[handleAddArea] ✅ Canvas: ${canvas?.nome}, Scale: ${scale.toFixed(3)}`);
    console.log("[handleAddArea] Editor:", { x: newArea.x, y: newArea.y, w: newArea.width, h: newArea.height });

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
      
      console.log("[handleAddArea] Real:", { x: areaReal.x, y: areaReal.y, w: areaReal.width, h: areaReal.height });
      
      await (supabase as any).from("mockup_areas").insert([areaReal]);
      toast.success("Área adicionada");
      setShowNewAreaForm(false);
      carregarAreas(activeCanvas);
    } catch (error) {
      toast.error("Erro ao adicionar área");
    }
  };

  const handleUpdateArea = async (areaId: string, updates: Partial<Area>) => {
    if (!scaleReady) {
      toast.error("⚠️ Aguarde a imagem carregar completamente antes de editar áreas");
      return;
    }

    const canvas = canvases.find(c => c.id === activeCanvas);
    console.log(`[handleUpdateArea] ✅ Canvas: ${canvas?.nome}, Scale: ${scale.toFixed(3)}, Editor:`, updates);

    try {
      // Converter coordenadas do editor (escalado) para real antes de salvar
      const updatesReal: Partial<Area> = { ...updates };
      if (updates.x !== undefined) updatesReal.x = toRealCoordinates(updates.x);
      if (updates.y !== undefined) updatesReal.y = toRealCoordinates(updates.y);
      if (updates.width !== undefined) updatesReal.width = toRealCoordinates(updates.width);
      if (updates.height !== undefined) updatesReal.height = toRealCoordinates(updates.height);
      
      console.log("[handleUpdateArea] Real:", updatesReal);
      
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
      
      console.log(`[handleSaveEditArea] Canvas: ${activeCanvas}, Scale: ${scale.toFixed(3)}`);
      console.log(`[handleSaveEditArea] Valores a salvar (real):`, {
        x: updates.x,
        y: updates.y,
        w: updates.width,
        h: updates.height,
      });
      
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
      
      console.log(`[handleDuplicateArea] Canvas: ${activeCanvas}, Scale: ${scale.toFixed(3)}`);
      console.log(`[handleDuplicateArea] Área duplicada (real):`, {
        x: areaDuplicada.x,
        y: areaDuplicada.y,
        w: areaDuplicada.width,
        h: areaDuplicada.height,
      });
      
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

  const handleAplicarTemplate = async (templateId: string) => {
    if (!activeCanvas) {
      toast.error("Selecione um canvas primeiro");
      return;
    }

    try {
      // Carregar os itens do template
      const { data: templateItems, error } = await supabase
        .from('area_template_items')
        .select('*')
        .eq('template_id', templateId);

      if (error) throw error;

      if (!templateItems || templateItems.length === 0) {
        toast.error("Este template não possui áreas configuradas");
        return;
      }

      // Converter as áreas do template para áreas do mockup
      const novasAreas = templateItems.map(item => ({
        canvas_id: activeCanvas,
        mockup_id: mockup.id,
        kind: item.kind,
        field_key: item.field_key,
        x: item.x,
        y: item.y,
        width: item.width,
        height: item.height,
        z_index: item.z_index,
        rotation: item.rotation,
        font_family: item.font_family,
        font_size: item.font_size,
        font_weight: item.font_weight,
        color: item.color,
        text_align: item.text_align,
        letter_spacing: item.letter_spacing,
        line_height: item.line_height,
      }));

      // Inserir todas as áreas
      const { error: insertError } = await supabase
        .from('mockup_areas')
        .insert(novasAreas);

      if (insertError) throw insertError;

      toast.success(`Template aplicado! ${novasAreas.length} área(s) adicionada(s)`);
      carregarAreas(activeCanvas);
    } catch (error) {
      console.error('Erro ao aplicar template:', error);
      toast.error("Erro ao aplicar template");
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
                value={mockupInfo.mockup_aprovacao_vinculado_id || "none"}
                onValueChange={(v) => setMockupInfo({ ...mockupInfo, mockup_aprovacao_vinculado_id: v === "none" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mockup de aprovação" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
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
            <TabsTrigger key={c.id} value={c.id} className="relative group">
              {c.nome}
              <span className="ml-2 text-xs opacity-60">
                (escala: {canvasScales[c.id]?.toFixed(2) || '?'})
              </span>
              {canvases.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCanvas(c.id);
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {canvases.map((canvas) => (
          <TabsContent key={canvas.id} value={canvas.id}>
            {!scaleReady && (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-lg flex items-center gap-2 mb-4">
                <span className="text-lg">⚠️</span>
                <span className="font-medium">Aguardando imagem carregar... Não edite áreas até que esta mensagem desapareça.</span>
              </div>
            )}
            
            <div className="grid grid-cols-[1fr_400px] gap-6">
              {/* Visual Canvas Editor */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>{canvas.nome}</CardTitle>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setAplicarTemplateOpen(true)}
                      disabled={!scaleReady}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Aplicar Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalvarTemplateOpen(true)}
                      disabled={areas.length === 0 || !scaleReady}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar como Template
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRecalcularEscala(canvas.id)}
                      disabled={!canvas.largura_original || uploading}
                      title="Recalcular escala baseado nas dimensões originais"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recalcular Escala
                    </Button>
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
                    <>
                      {imageRef.current && imageRef.current.naturalWidth > 0 && (
                        <div className="text-xs text-muted-foreground mb-2">
                          Resolução: {imageRef.current.naturalWidth} × {imageRef.current.naturalHeight}px
                          (exibindo em {imageRef.current.width}px)
                        </div>
                      )}
                      <div 
                        ref={canvasRef}
                        className="relative border border-border rounded-lg overflow-hidden bg-muted"
                        style={{ 
                          cursor: dragging || resizing ? 'grabbing' : 'default',
                          maxWidth: '800px',
                          margin: '0 auto'
                        }}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                      >
                        <img 
                          ref={imageRef}
                          src={canvas.imagem_base} 
                          alt={canvas.nome} 
                          className="w-full h-auto block"
                          style={{ maxWidth: '800px' }}
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
                  </>
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

      {/* Dialogs de Template */}
      <SalvarTemplateDialog
        open={salvarTemplateOpen}
        onOpenChange={setSalvarTemplateOpen}
        areas={areas}
      />
      <AplicarTemplateDialog
        open={aplicarTemplateOpen}
        onOpenChange={setAplicarTemplateOpen}
        onApply={handleAplicarTemplate}
      />
    </div>
  );
}
