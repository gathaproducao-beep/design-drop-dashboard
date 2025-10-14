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

interface PedidosTableProps {
  pedidos: any[];
  loading: boolean;
  onRefresh: () => void;
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
}

export function PedidosTable({ 
  pedidos, 
  loading, 
  onRefresh, 
  selectedIds, 
  onSelectionChange 
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
      toast.success("Campo atualizado");
      onRefresh();
    } catch (error) {
      console.error("Erro ao atualizar:", error);
      toast.error("Erro ao atualizar");
    }
  };

  const handleGerarMockups = async (pedido: any) => {
    if (!pedido.fotos_cliente || pedido.fotos_cliente.length === 0) {
      toast.error("É necessário ter pelo menos uma foto do cliente para gerar mockups");
      return;
    }

    setGenerating(pedido.id);
    try {
      // Buscar mockups e seus canvases/áreas
      const { data: mockups, error: mockupError } = await supabase
        .from("mockups")
        .select(`
          *,
          mockup_canvases (
            *,
            mockup_areas (*)
          )
        `)
        .eq("codigo_mockup", pedido.codigo_produto);

      if (mockupError || !mockups || mockups.length === 0) {
        toast.error("Nenhum mockup encontrado para este código de produto");
        return;
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
          const ctx = canvas.getContext("2d");
          if (!ctx) continue;

          // Carregar imagem base do canvas
          const baseImg = new Image();
          baseImg.crossOrigin = "anonymous";
          
          await new Promise<void>((resolve, reject) => {
            baseImg.onload = () => resolve();
            baseImg.onerror = reject;
            baseImg.src = canvasData.imagem_base;
          });

          canvas.width = baseImg.width;
          canvas.height = baseImg.height;
          ctx.drawImage(baseImg, 0, 0);

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

              // Calcular dimensões mantendo proporção (contain)
              const aspectRatio = clientImg.width / clientImg.height;
              const areaAspect = area.width / area.height;
              
              let drawWidth = area.width;
              let drawHeight = area.height;
              let offsetX = 0;
              let offsetY = 0;

              if (aspectRatio > areaAspect) {
                drawHeight = area.width / aspectRatio;
                offsetY = (area.height - drawHeight) / 2;
              } else {
                drawWidth = area.height * aspectRatio;
                offsetX = (area.width - drawWidth) / 2;
              }

              ctx.drawImage(
                clientImg,
                area.x + offsetX,
                area.y + offsetY,
                drawWidth,
                drawHeight
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

          // Converter para blob
          const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/png");
          });

          // Upload para storage
          const fileName = `${mockup.tipo}/${pedido.numero_pedido}-${mockup.tipo}-${canvasData.nome}-${Date.now()}.png`;
          const { error: uploadError } = await supabase.storage
            .from("mockup-images")
            .upload(fileName, blob);

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

      toast.success("Mockups gerados com sucesso!");
      onRefresh();
    } catch (error) {
      console.error("Erro ao gerar mockups:", error);
      toast.error("Erro ao gerar mockups");
    } finally {
      setGenerating(null);
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
