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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ExternalLink, Image as ImageIcon, Loader2, Edit, Trash2 } from "lucide-react";
import { ImageUploadDialog } from "./ImageUploadDialog";
import { ImageViewDialog } from "./ImageViewDialog";
import { EditableCell } from "./EditableCell";
import { EditarPedidoDialog } from "./EditarPedidoDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { generateMockupsForPedido } from "@/lib/mockup-generator";

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
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pedidoToDelete, setPedidoToDelete] = useState<string | null>(null);
  const [generating, setGenerating] = useState<string | null>(null);

  const handleImageClick = (pedido: any, type: "cliente" | "aprovacao" | "molde") => {
    setSelectedPedido(pedido);
    if (type === "cliente") {
      // Sempre abre o dialog de upload para permitir visualizar E excluir fotos
      setUploadDialogOpen(true);
    } else if (type === "aprovacao") {
      if (pedido.foto_aprovacao && pedido.foto_aprovacao.length > 0) {
        setSelectedImageType("foto_aprovacao");
        setViewDialogOpen(true);
      }
    } else if (type === "molde") {
      if (pedido.molde_producao && pedido.molde_producao.length > 0) {
        setSelectedImageType("molde_producao");
        setViewDialogOpen(true);
      }
    }
  };

  const handleUpdateField = async (pedidoId: string, field: string, value: any) => {
    try {
      // Se está mudando status de mensagem para "reenviar", processar envio
      if (field === "mensagem_enviada" && value === "reenviar") {
        toast.loading("Processando envio...", { id: `envio-${pedidoId}` });
        
        const { processarEnvioPedido, formatPhone } = await import("@/lib/whatsapp");
        const result = await processarEnvioPedido(pedidoId);
        
        toast.success(
          `Mensagem adicionada à fila!\nTemplate: ${result.mensagemUsada}\nTelefone: ${formatPhone(result.telefone)}`,
          { id: `envio-${pedidoId}`, duration: 5000 }
        );
        
        // Recarregar dados
        onRefresh();
        return;
      }
      
      // Atualização normal para outros campos
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
    } catch (error: any) {
      console.error("Erro ao atualizar:", error);
      toast.error(error.message || "Erro ao atualizar");
    }
  };

  const handleGerarMockups = async (pedido: any, tipoGerar: 'all' | 'aprovacao' | 'molde' = 'all') => {
    if (!pedido.fotos_cliente || pedido.fotos_cliente.length === 0) {
      toast.error("Adicione fotos do cliente antes de gerar os mockups");
      return;
    }

    setGenerating(pedido.id);
    
    try {
      await generateMockupsForPedido(pedido, tipoGerar, (msg) => {
        console.log(`[Mockup ${pedido.numero_pedido}] ${msg}`);
      });
      
      toast.success("Mockup gerado com sucesso!");
      onRefresh();
    } catch (error) {
      console.error("Erro ao gerar mockup:", error);
      toast.error("Erro ao gerar mockup");
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

  const handleDeletePedido = async () => {
    if (!pedidoToDelete) return;

    try {
      const pedido = pedidos.find(p => p.id === pedidoToDelete);
      if (!pedido) return;

      // Deletar fotos do storage
      const fotosParaDeletar: string[] = [];
      
      if (pedido.fotos_cliente) {
        pedido.fotos_cliente.forEach((url: string) => {
          const fileName = url.split("/").pop();
          if (fileName) fotosParaDeletar.push(`clientes/${fileName}`);
        });
      }

      if (fotosParaDeletar.length > 0) {
        await supabase.storage.from("mockup-images").remove(fotosParaDeletar);
      }

      // Primeiro excluir mensagens da fila do WhatsApp relacionadas ao pedido
      await supabase
        .from("whatsapp_queue")
        .delete()
        .eq("pedido_id", pedidoToDelete);

      // Depois deletar o pedido
      const { error } = await (supabase as any)
        .from("pedidos")
        .delete()
        .eq("id", pedidoToDelete);

      if (error) throw error;

      toast.success("Pedido excluído com sucesso!");
      onRefresh();
    } catch (error) {
      console.error("Erro ao deletar pedido:", error);
      toast.error("Erro ao deletar pedido");
    } finally {
      setDeleteDialogOpen(false);
      setPedidoToDelete(null);
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
    if (value === "enviando") return "outline";
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
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita e todas as fotos associadas serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPedidoToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePedido}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                <TableCell className="text-center">
                  {pedido.fotos_cliente && pedido.fotos_cliente.length > 0 ? (
                    <div 
                      className="relative inline-block cursor-pointer hover:opacity-80 transition"
                      onClick={() => handleImageClick(pedido, "cliente")}
                    >
                      <img 
                        src={pedido.fotos_cliente[0]} 
                        alt="Foto Cliente"
                        className="h-10 w-10 rounded object-cover border"
                      />
                      {pedido.fotos_cliente.length > 1 && (
                        <Badge 
                          className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                          variant="secondary"
                        >
                          +{pedido.fotos_cliente.length - 1}
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-primary h-8"
                      onClick={() => {
                        setSelectedPedido(pedido);
                        setUploadDialogOpen(true);
                      }}
                    >
                      <ImageIcon className="h-4 w-4 mr-1" />
                      <span className="text-xs">Adicionar</span>
                    </Button>
                  )}
                </TableCell>
                <TableCell>
                  {pedido.foto_aprovacao && pedido.foto_aprovacao.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImageClick(pedido, "aprovacao")}
                      className="hover:bg-primary/10 relative"
                    >
                      <ImageIcon className="h-4 w-4 text-primary" />
                      {pedido.foto_aprovacao.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {pedido.foto_aprovacao.length}
                        </span>
                      )}
                    </Button>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell>
                  <EditableCell
                    value={pedido.mensagem_enviada}
                    type="select"
                    options={["pendente", "enviando", "enviada", "erro", "reenviar"]}
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
                  {pedido.molde_producao && pedido.molde_producao.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleImageClick(pedido, "molde")}
                      className="hover:bg-primary/10 relative"
                    >
                      <ImageIcon className="h-4 w-4 text-primary" />
                      {pedido.molde_producao.length > 1 && (
                        <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-4 w-4 flex items-center justify-center">
                          {pedido.molde_producao.length}
                        </span>
                      )}
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
                  <div className="flex items-center gap-1">
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedPedido(pedido);
                        setEditDialogOpen(true);
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => {
                        setPedidoToDelete(pedido.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
            imageUrl={selectedPedido[selectedImageType] || ""}
            title={
              selectedImageType === "fotos_cliente" ? "Fotos do Cliente" :
              selectedImageType === "foto_aprovacao" ? "Foto de Aprovação" :
              "Molde de Produção"
            }
          />
          <EditarPedidoDialog
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            pedido={selectedPedido}
            onSuccess={() => {
              onRefresh();
              setEditDialogOpen(false);
            }}
          />
        </>
      )}
    </>
  );
}
