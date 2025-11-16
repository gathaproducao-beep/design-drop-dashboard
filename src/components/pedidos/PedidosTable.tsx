import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ExternalLink, Image as ImageIcon, Loader2 } from "lucide-react";
import { ImageUploadDialog } from "./ImageUploadDialog";
import { ImageViewDialog } from "./ImageViewDialog";
import { EditableCell } from "./EditableCell";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// CRC32 table para calcular checksum do PNG
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ data[i]) & 0xFF];
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Extrair dimensões do chunk IHDR
function getIHDRDimensions(pngData: Uint8Array): { width: number; height: number } {
  // IHDR está logo após a assinatura PNG (8 bytes)
  // Formato: length(4) + "IHDR"(4) + width(4) + height(4) + ...
  const width = (pngData[16] << 24) | (pngData[17] << 16) | (pngData[18] << 8) | pngData[19];
  const height = (pngData[20] << 24) | (pngData[21] << 16) | (pngData[22] << 8) | pngData[23];
  return { width, height };
}

// Função para definir chunk pHYs com 300 DPI
function setPHYsTo300DPI(pngData: Uint8Array): Uint8Array {
  const result: number[] = [];
  let i = 0;
  let physFound = false;
  let ihdrProcessed = false;
  
  // 300 DPI = 11811 pixels/metro (300 / 0.0254 ≈ 11811)
  const ppm = 11811; // pixels per meter
  
  // Criar chunk pHYs correto
  const createPHYsChunk = (): number[] => {
    const chunk: number[] = [];
    
    // Length (4 bytes) - pHYs data tem 9 bytes
    chunk.push(0, 0, 0, 9);
    
    // Type "pHYs" (4 bytes)
    chunk.push(112, 72, 89, 115); // "pHYs"
    
    // Data (9 bytes):
    // - pixels per unit, X axis (4 bytes)
    chunk.push((ppm >>> 24) & 0xFF, (ppm >>> 16) & 0xFF, (ppm >>> 8) & 0xFF, ppm & 0xFF);
    // - pixels per unit, Y axis (4 bytes)
    chunk.push((ppm >>> 24) & 0xFF, (ppm >>> 16) & 0xFF, (ppm >>> 8) & 0xFF, ppm & 0xFF);
    // - unit specifier (1 byte): 1 = meters
    chunk.push(1);
    
    // Calcular CRC dos dados (type + data)
    const crcData = new Uint8Array([
      112, 72, 89, 115, // "pHYs"
      (ppm >>> 24) & 0xFF, (ppm >>> 16) & 0xFF, (ppm >>> 8) & 0xFF, ppm & 0xFF,
      (ppm >>> 24) & 0xFF, (ppm >>> 16) & 0xFF, (ppm >>> 8) & 0xFF, ppm & 0xFF,
      1
    ]);
    const crc = crc32(crcData);
    
    // CRC (4 bytes)
    chunk.push((crc >>> 24) & 0xFF, (crc >>> 16) & 0xFF, (crc >>> 8) & 0xFF, crc & 0xFF);
    
    return chunk;
  };
  
  // PNG signature (8 bytes) - copiar sempre
  for (let j = 0; j < 8; j++) {
    result.push(pngData[i++]);
  }
  
  // Processar chunks
  while (i < pngData.length) {
    // Ler tamanho do chunk (4 bytes)
    const length = (pngData[i] << 24) | (pngData[i+1] << 16) | 
                   (pngData[i+2] << 8) | pngData[i+3];
    
    // Ler tipo do chunk (4 bytes)
    const type = String.fromCharCode(
      pngData[i+4], pngData[i+5], pngData[i+6], pngData[i+7]
    );
    
    // Se for IHDR, copiar e marcar que pode inserir pHYs depois
    if (type === 'IHDR') {
      const chunkSize = 12 + length;
      for (let j = 0; j < chunkSize; j++) {
        result.push(pngData[i++]);
      }
      ihdrProcessed = true;
      
      // Se não houver pHYs no arquivo original, inserir agora
      // (verificamos se há pHYs fazendo uma busca rápida)
      let hasPhys = false;
      let tempI = i;
      while (tempI < pngData.length) {
        const tempType = String.fromCharCode(
          pngData[tempI+4], pngData[tempI+5], pngData[tempI+6], pngData[tempI+7]
        );
        if (tempType === 'pHYs') {
          hasPhys = true;
          break;
        }
        if (tempType === 'IDAT' || tempType === 'IEND') break;
        const tempLength = (pngData[tempI] << 24) | (pngData[tempI+1] << 16) | 
                          (pngData[tempI+2] << 8) | pngData[tempI+3];
        tempI += 12 + tempLength;
      }
      
      if (!hasPhys) {
        console.log('[setPHYsTo300DPI] Chunk pHYs não encontrado, inserindo novo com 300 DPI');
        result.push(...createPHYsChunk());
        physFound = true;
      }
      
      continue;
    }
    
    // Se for pHYs, substituir por versão com 300 DPI
    if (type === 'pHYs') {
      console.log('[setPHYsTo300DPI] Chunk pHYs encontrado, substituindo por 300 DPI');
      i += 12 + length; // Pular chunk original
      result.push(...createPHYsChunk());
      physFound = true;
      continue;
    }
    
    // Copiar chunk completo
    const chunkSize = 12 + length;
    for (let j = 0; j < chunkSize; j++) {
      result.push(pngData[i++]);
    }
    
    // Se chegou no IEND, terminar
    if (type === 'IEND') break;
  }
  
  const resultArray = new Uint8Array(result);
  const dimensions = getIHDRDimensions(resultArray);
  
  console.log('[setPHYsTo300DPI] PNG processado:', {
    dimensoes: `${dimensions.width}x${dimensions.height}px`,
    dpi: 300,
    physEncontrado: physFound,
    tamanhoOriginal: pngData.length,
    tamanhoNovo: resultArray.length
  });
  
  return resultArray;
}

interface PedidosTableProps {
  pedidos: any[];
  loading: boolean;
  onRefresh: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  gerarFotoAuto?: boolean;
}

export function PedidosTable({ 
  pedidos, 
  loading, 
  onRefresh, 
  selectedIds, 
  onSelectionChange,
  gerarFotoAuto = false
}: PedidosTableProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedPedido, setSelectedPedido] = useState<any>(null);
  const [selectedImageType, setSelectedImageType] = useState<string>("");
  const [generating, setGenerating] = useState<string | null>(null);

  const handleImageClick = (pedido: any, type: "cliente" | "aprovacao" | "molde") => {
    setSelectedPedido(pedido);
    if (type === "cliente") {
      setSelectedImageType("foto_cliente");
      setUploadDialogOpen(true);
    } else if (type === "aprovacao") {
      if (pedido.foto_aprovacao) {
        setSelectedImageType("foto_aprovacao");
        setViewDialogOpen(true);
      }
    } else if (type === "molde") {
      if (pedido.molde_producao) {
        setSelectedImageType("molde_producao");
        setViewDialogOpen(true);
      }
    }
  };

  const handleUpdateField = async (pedidoId: string, field: string, value: any) => {
    try {
      const { error } = await supabase
        .from("pedidos")
        .update({ [field]: value })
        .eq("id", pedidoId);

      if (error) throw error;
      
      // Se geração automática estiver ativada e o campo atualizado for layout_aprovado
      if (gerarFotoAuto && field === "layout_aprovado" && value === "aprovado") {
        // Buscar o pedido atualizado
        const pedidoAtualizado = pedidos.find(p => p.id === pedidoId);
        if (pedidoAtualizado && pedidoAtualizado.fotos_cliente?.length > 0) {
          // Gerar molde automaticamente (sem aguardar para não bloquear a UI)
          setTimeout(() => {
            handleGerarMockups(pedidoAtualizado, 'molde');
          }, 500);
        }
      }
      
      toast.success("Campo atualizado");
      onRefresh();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const handleGerarMockups = async (pedido: any, tipoGerar?: 'aprovacao' | 'molde' | 'ambos') => {
    if (!pedido.fotos_cliente || pedido.fotos_cliente.length === 0) {
      toast.error("É necessário ter pelo menos uma foto do cliente para gerar mockups");
      return;
    }

    setGenerating(pedido.id);
    try {
      // Buscar mockup principal pelo código do produto
      const { data: mockupsPrincipais, error: mockupError } = await supabase
        .from("mockups")
        .select(`
          *,
          mockup_canvases (
            *,
            mockup_areas (*)
          )
        `)
        .eq("codigo_mockup", pedido.codigo_produto);

      if (mockupError || !mockupsPrincipais || mockupsPrincipais.length === 0) {
        toast.error("Nenhum mockup encontrado para este código de produto");
        return;
      }

      let mockups = mockupsPrincipais;

      // Se o mockup principal for do tipo "molde" e tiver vinculação com mockup de aprovação
      const mockupPrincipal = mockupsPrincipais[0];
      if (mockupPrincipal.tipo === "molde" && mockupPrincipal.mockup_aprovacao_vinculado_id) {
        // Buscar também o mockup de aprovação vinculado
        const { data: mockupAprovacao, error: aprovacaoError } = await supabase
          .from("mockups")
          .select(`
            *,
            mockup_canvases (
              *,
              mockup_areas (*)
            )
          `)
          .eq("id", mockupPrincipal.mockup_aprovacao_vinculado_id)
          .single();

        if (!aprovacaoError && mockupAprovacao) {
          // Adicionar mockup de aprovação no início do array (será gerado primeiro)
          mockups = [mockupAprovacao, ...mockupsPrincipais];
          console.log("Gerando mockup de aprovação vinculado:", mockupAprovacao.codigo_mockup);
        }
      }

      // Filtrar mockups baseado no tipoGerar
      if (tipoGerar === 'aprovacao') {
        mockups = mockups.filter(m => m.tipo === 'aprovacao');
        if (mockups.length === 0) {
          toast.error("Nenhum mockup de aprovação encontrado");
          return;
        }
      } else if (tipoGerar === 'molde') {
        mockups = mockups.filter(m => m.tipo === 'molde');
        if (mockups.length === 0) {
          toast.error("Nenhum mockup de molde encontrado");
          return;
        }
      }

      // Processar cada mockup
      const results: { tipo: string; url: string }[] = [];
      
      for (const mockup of mockups) {
        const canvases = mockup.mockup_canvases || [];
        
        if (canvases.length === 0) {
          console.warn("Mockup sem canvases:", mockup.id);
          continue;
        }

        // Para cada canvas do mockup
        for (const canvasData of canvases) {
          const areas = canvasData.mockup_areas || [];
          
          // Criar canvas HTML
          const canvas = document.createElement("canvas");
          // Forçar contexto sem scaling automático
          const ctx = canvas.getContext("2d", { 
            alpha: true,
            willReadFrequently: false 
          });
          if (!ctx) continue;

          // Resetar qualquer transformação que possa existir
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';

          // Carregar imagem base do canvas
          const baseImg = new Image();
          baseImg.crossOrigin = "anonymous";
          
          await new Promise<void>((resolve, reject) => {
            baseImg.onload = () => resolve();
            baseImg.onerror = reject;
            baseImg.src = canvasData.imagem_base;
          });

          console.log(`[generateMockups] Imagem base carregada:`, {
            width: baseImg.width,
            height: baseImg.height,
            naturalWidth: baseImg.naturalWidth,
            naturalHeight: baseImg.naturalHeight,
            devicePixelRatio: window.devicePixelRatio
          });

          // Usar dimensões naturais da imagem (originais, sem escala do navegador)
          canvas.width = Math.round(baseImg.naturalWidth);
          canvas.height = Math.round(baseImg.naturalHeight);
          
          // Garantir que o backing store seja 1:1
          canvas.style.width = `${canvas.width}px`;
          canvas.style.height = `${canvas.height}px`;
          
          ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);
          console.log(`[generateMockups] Canvas criado: ${canvas.width}x${canvas.height}px (style: ${canvas.style.width}x${canvas.style.height})`);

          // Processar cada área
          for (const area of areas) {
            if (area.kind === "image") {
              // Extrair índice da foto (ex: fotocliente[1] -> 1)
              const match = area.field_key.match(/fotocliente\[(\d+)\]/);
              const photoIndex = match ? parseInt(match[1]) - 1 : 0;
              
              const photoUrl = pedido.fotos_cliente[photoIndex];
              if (!photoUrl) continue;

              // Carregar foto do cliente
              const clientImg = new Image();
              clientImg.crossOrigin = "anonymous";
              
              await new Promise<void>((resolve, reject) => {
                clientImg.onload = () => resolve();
                clientImg.onerror = reject;
                clientImg.src = photoUrl;
              });

              console.log(`[generateMockups] Foto cliente carregada:`, {
                width: clientImg.width,
                height: clientImg.height,
                naturalWidth: clientImg.naturalWidth,
                naturalHeight: clientImg.naturalHeight
              });

              // Usar dimensões naturais da imagem do cliente
              const aspectRatio = clientImg.naturalWidth / clientImg.naturalHeight;
              const areaAspect = area.width / area.height;
              
              let sourceX = 0;
              let sourceY = 0;
              let sourceWidth = clientImg.naturalWidth;
              let sourceHeight = clientImg.naturalHeight;

              // Recortar a imagem para manter proporção e preencher toda a área (cover)
              if (aspectRatio > areaAspect) {
                // Imagem mais larga - recortar largura
                sourceWidth = clientImg.naturalHeight * areaAspect;
                sourceX = (clientImg.naturalWidth - sourceWidth) / 2;
              } else {
                // Imagem mais alta - recortar altura
                sourceHeight = clientImg.naturalWidth / areaAspect;
                sourceY = (clientImg.naturalHeight - sourceHeight) / 2;
              }

              console.log(`[generateMockups] Desenhando área:`, {
                areaId: area.id?.substring(0, 8),
                x: area.x,
                y: area.y,
                width: area.width,
                height: area.height,
                canvasSize: `${canvas.width}x${canvas.height}`
              });

              // Desenhar usando as dimensões exatas da área
              ctx.drawImage(
                clientImg,
                sourceX,
                sourceY,
                sourceWidth,
                sourceHeight,
                area.x,
                area.y,
                area.width,
                area.height
              );
            } else if (area.kind === "text") {
              // Renderizar texto
              let textValue = "";
              switch (area.field_key) {
                case "numero_pedido":
                  textValue = pedido.numero_pedido || "";
                  break;
                case "codigo_produto":
                  textValue = pedido.codigo_produto || "";
                  break;
                case "data_pedido":
                  textValue = pedido.data_pedido ? new Date(pedido.data_pedido).toLocaleDateString() : "";
                  break;
                case "observacao":
                  textValue = pedido.observacao || "";
                  break;
              }

              if (textValue) {
                ctx.save();
                ctx.font = `${area.font_weight || "normal"} ${area.font_size || 16}px ${area.font_family || "Arial"}`;
                ctx.fillStyle = area.color || "#000000";
                ctx.textAlign = (area.text_align || "left") as CanvasTextAlign;
                
                // Posição do texto
                let textX = area.x;
                if (area.text_align === "center") textX = area.x + area.width / 2;
                else if (area.text_align === "right") textX = area.x + area.width;

                ctx.fillText(textValue, textX, area.y + (area.font_size || 16));
                ctx.restore();
              }
            }
          }

          // Converter canvas para blob
          console.log(`[generateMockups] Preparando exportação - Canvas: ${canvas.width}x${canvas.height}px`);
          
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => {
              if (!b) {
                console.error('[generateMockups] Falha ao gerar blob');
                resolve(new Blob());
                return;
              }
              console.log(`[generateMockups] Blob inicial gerado:`, {
                size: `${(b.size / 1024 / 1024).toFixed(2)} MB`,
                width: canvas.width,
                height: canvas.height,
                type: b.type
              });
              resolve(b);
            }, "image/png", 1.0);
          });
          
          // Processar PNG para definir pHYs com 300 DPI
          console.log('[generateMockups] Processando PNG para definir 300 DPI...');
          const arrayBuffer = await blob.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          const fixedPng = setPHYsTo300DPI(uint8Array);
          // Criar novo ArrayBuffer para garantir compatibilidade de tipos
          const cleanBuffer = fixedPng.buffer.slice(fixedPng.byteOffset, fixedPng.byteOffset + fixedPng.byteLength) as ArrayBuffer;
          const cleanBlob = new Blob([cleanBuffer], { type: 'image/png' });
          
          // Extrair e logar dimensões reais do PNG final
          const finalDimensions = getIHDRDimensions(fixedPng);
          console.log(`[generateMockups] PNG final criado:`, {
            size: `${(cleanBlob.size / 1024 / 1024).toFixed(2)} MB`,
            dimensoesPNG: `${finalDimensions.width}x${finalDimensions.height}px`,
            dimensoesCanvas: `${canvas.width}x${canvas.height}px`,
            dimensoesBase: `${baseImg.naturalWidth}x${baseImg.naturalHeight}px`,
            dpi: 300,
            match: finalDimensions.width === baseImg.naturalWidth && finalDimensions.height === baseImg.naturalHeight ? '✓' : '✗'
          });

          // Upload para storage usando o PNG limpo (sem metadados DPI)
          const fileName = `${mockup.tipo}/${pedido.numero_pedido}-${mockup.tipo}-${canvasData.nome}-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from("mockup-images")
            .upload(fileName, cleanBlob);

          if (uploadError) {
            console.error("Erro ao fazer upload:", uploadError);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from("mockup-images")
            .getPublicUrl(fileName);

          results.push({ tipo: mockup.tipo, url: publicUrl });
        }
      }

      // Atualizar pedido com as URLs geradas (usar a primeira de cada tipo)
      const updateData: any = {};
      const aprovacaoResult = results.find(r => r.tipo === "aprovacao");
      const moldeResult = results.find(r => r.tipo === "molde");
      
      if (aprovacaoResult) updateData.foto_aprovacao = aprovacaoResult.url;
      if (moldeResult) updateData.molde_producao = moldeResult.url;

      if (Object.keys(updateData).length > 0) {
        updateData.mensagem_enviada = "enviada";
        
        const { error: updateError } = await supabase
          .from("pedidos")
          .update(updateData)
          .eq("id", pedido.id);

        if (updateError) throw updateError;
      }

      const tipoMsg = tipoGerar === 'aprovacao' ? 'Foto de aprovação' : 
                      tipoGerar === 'molde' ? 'Molde de produção' : 'Mockups';
      toast.success(`${tipoMsg} gerado com sucesso!`);
      onRefresh();
    } catch (error) {
      console.error("Erro ao gerar mockups:", error);
      toast.error("Erro ao gerar mockups");
    } finally {
      setGenerating(null);
    }
  };

  const handleFotosClienteUpdated = async (pedido: any) => {
    if (gerarFotoAuto && pedido.fotos_cliente?.length > 0) {
      try {
        toast.info("Gerando foto de aprovação automaticamente...");
        await handleGerarMockups(pedido, 'aprovacao');
      } catch (error) {
        console.error("Erro na geração automática:", error);
        toast.error("Erro ao gerar foto de aprovação automaticamente");
      }
    }
  };

  const handleToggleAll = () => {
    if (selectedIds.size === pedidos.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(pedidos.map(p => p.id)));
    }
  };

  const handleToggle = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    onSelectionChange(newSet);
  };

  const getRowClassName = (layoutAprovado: string) => {
    if (layoutAprovado === "aprovado") return "bg-green-50 hover:bg-green-100";
    if (layoutAprovado === "reprovado") return "bg-red-50 hover:bg-red-100";
    return "hover:bg-muted/30";
  };

  const getBadgeVariant = (value: string) => {
    if (value === "enviada" || value === "aprovado") return "default";
    if (value === "erro" || value === "reprovado") return "destructive";
    return "secondary";
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">
                <Checkbox
                  checked={pedidos.length > 0 && selectedIds.size === pedidos.length}
                  onCheckedChange={handleToggleAll}
                />
              </TableHead>
              <TableHead className="font-semibold">Número</TableHead>
              <TableHead className="font-semibold">Cliente</TableHead>
              <TableHead className="font-semibold">Código Produto</TableHead>
              <TableHead className="font-semibold">Data Pedido</TableHead>
              <TableHead className="font-semibold">Telefone</TableHead>
              <TableHead className="font-semibold">Foto Cliente</TableHead>
              <TableHead className="font-semibold">Foto Aprovação</TableHead>
              <TableHead className="font-semibold">Mensagem</TableHead>
              <TableHead className="font-semibold">Layout</TableHead>
              <TableHead className="font-semibold">Molde</TableHead>
              <TableHead className="font-semibold">Data Impressão</TableHead>
              <TableHead className="font-semibold">Observação</TableHead>
              <TableHead className="font-semibold">Drive</TableHead>
              <TableHead className="font-semibold">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pedidos.map((pedido) => (
              <TableRow 
                key={pedido.id} 
                className={cn("transition-colors", getRowClassName(pedido.layout_aprovado))}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(pedido.id)}
                    onCheckedChange={() => handleToggle(pedido.id)}
                  />
                </TableCell>
                <TableCell className="font-medium">{pedido.numero_pedido}</TableCell>
                <TableCell>{pedido.nome_cliente}</TableCell>
                <TableCell>{pedido.codigo_produto}</TableCell>
                <TableCell>{new Date(pedido.data_pedido).toLocaleDateString()}</TableCell>
                <TableCell>{pedido.telefone || "-"}</TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleImageClick(pedido, "cliente")}
                    className="hover:bg-primary/10"
                  >
                    <ImageIcon className={pedido.fotos_cliente?.length > 0 ? "h-4 w-4 text-primary" : "h-4 w-4"} />
                  </Button>
                </TableCell>
                <TableCell>
                  {pedido.foto_aprovacao ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImageClick(pedido, "aprovacao")}
                      className="hover:bg-primary/10"
                    >
                      <ImageIcon className="h-4 w-4 text-primary" />
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={pedido.mensagem_enviada}
                    type="select"
                    options={["enviada", "erro", "pendente"]}
                    onSave={(value) => handleUpdateField(pedido.id, "mensagem_enviada", value)}
                    renderValue={(value) => (
                      <Badge variant={getBadgeVariant(value)}>{value}</Badge>
                    )}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={pedido.layout_aprovado}
                    type="select"
                    options={["aprovado", "reprovado", "pendente"]}
                    onSave={(value) => handleUpdateField(pedido.id, "layout_aprovado", value)}
                    renderValue={(value) => (
                      <Badge variant={getBadgeVariant(value)}>{value}</Badge>
                    )}
                  />
                </TableCell>
                <TableCell>
                  {pedido.molde_producao ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImageClick(pedido, "molde")}
                      className="hover:bg-primary/10"
                    >
                      <ImageIcon className="h-4 w-4 text-primary" />
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={pedido.data_impressao || ""}
                    type="date"
                    onSave={(value) => handleUpdateField(pedido.id, "data_impressao", value)}
                  />
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={pedido.observacao || ""}
                    type="text"
                    onSave={(value) => handleUpdateField(pedido.id, "observacao", value)}
                  />
                </TableCell>
                <TableCell>
                  {pedido.pasta_drive_url ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(pedido.pasta_drive_url, "_blank")}
                      className="hover:bg-primary/10"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={() => handleGerarMockups(pedido)}
                    disabled={generating === pedido.id || !pedido.fotos_cliente || pedido.fotos_cliente.length === 0}
                    className="bg-gradient-to-r from-accent to-accent/80"
                  >
                    {generating === pedido.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Gerar"
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selectedPedido && (
        <>
          <ImageUploadDialog
            open={uploadDialogOpen}
            onOpenChange={setUploadDialogOpen}
            pedido={selectedPedido}
            onSuccess={onRefresh}
            gerarFotoAuto={gerarFotoAuto}
            onFotosUpdated={handleFotosClienteUpdated}
          />
          <ImageViewDialog
            open={viewDialogOpen}
            onOpenChange={setViewDialogOpen}
            imageUrl={selectedPedido[selectedImageType]}
            title={selectedImageType === "foto_aprovacao" ? "Foto de Aprovação" : "Molde de Produção"}
          />
        </>
      )}
    </>
  );
}
