import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Download } from "lucide-react";

interface TesteExportacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ResultadoTeste {
  formato: string;
  url: string;
  tamanho: string;
  blob: Blob;
}

export function TesteExportacaoDialog({ open, onOpenChange }: TesteExportacaoDialogProps) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [mockups, setMockups] = useState<any[]>([]);
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string>("");
  const [mockupSelecionado, setMockupSelecionado] = useState<string>("");
  const [carregando, setCarregando] = useState(false);
  const [resultados, setResultados] = useState<ResultadoTeste[]>([]);

  // Carregar pedidos quando o dialog abre
  const carregarPedidos = async () => {
    try {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id, numero_pedido, codigo_produto, fotos_cliente")
        .not("fotos_cliente", "is", null)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPedidos(data || []);
    } catch (error) {
      console.error("Erro ao carregar pedidos:", error);
      toast.error("Erro ao carregar pedidos");
    }
  };

  // Carregar mockups tipo "molde" quando seleciona um pedido
  const carregarMockups = async (codigoProduto: string) => {
    try {
      const { data, error } = await supabase
        .from("mockups")
        .select(`
          id,
          codigo_mockup,
          tipo,
          mockup_canvases(
            id,
            nome,
            imagem_base,
            mockup_areas(*)
          )
        `)
        .eq("codigo_mockup", codigoProduto)
        .eq("tipo", "molde");

      if (error) throw error;
      setMockups(data || []);
    } catch (error) {
      console.error("Erro ao carregar mockups:", error);
      toast.error("Erro ao carregar mockups");
    }
  };

  const handlePedidoChange = async (pedidoId: string) => {
    setPedidoSelecionado(pedidoId);
    setMockupSelecionado("");
    setResultados([]);

    const pedido = pedidos.find((p) => p.id === pedidoId);
    if (pedido) {
      await carregarMockups(pedido.codigo_produto);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
  };

  const gerarMockupTeste = async () => {
    if (!pedidoSelecionado || !mockupSelecionado) {
      toast.error("Selecione um pedido e um mockup");
      return;
    }

    setCarregando(true);
    setResultados([]);

    try {
      const pedido = pedidos.find((p) => p.id === pedidoSelecionado);
      const mockup = mockups.find((m) => m.id === mockupSelecionado);

      if (!pedido || !mockup) {
        throw new Error("Pedido ou mockup não encontrado");
      }

      toast.info("Gerando mockup em diferentes formatos...");

      // Usar apenas o primeiro canvas
      const canvasData = mockup.mockup_canvases[0];
      const areas = canvasData.mockup_areas || [];

      // Criar canvas HTML
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d", { 
        alpha: true,
        willReadFrequently: false 
      });
      
      if (!ctx) throw new Error("Erro ao criar contexto do canvas");

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Carregar imagem base
      const baseImg = new Image();
      baseImg.crossOrigin = "anonymous";
      
      await new Promise<void>((resolve, reject) => {
        baseImg.onload = () => resolve();
        baseImg.onerror = () => reject(new Error("Erro ao carregar imagem base"));
        baseImg.src = canvasData.imagem_base;
      });

      canvas.width = baseImg.naturalWidth;
      canvas.height = baseImg.naturalHeight;
      
      ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

      // Processar áreas (apenas imagens para simplificar)
      for (const area of areas) {
        if (area.kind === "image") {
          const match = area.field_key.match(/fotocliente\[(\d+)\]/);
          const photoIndex = match ? parseInt(match[1]) - 1 : 0;
          
          const photoUrl = pedido.fotos_cliente[photoIndex];
          if (!photoUrl) continue;

          const clientImg = new Image();
          clientImg.crossOrigin = "anonymous";
          
          await new Promise<void>((resolve, reject) => {
            clientImg.onload = () => resolve();
            clientImg.onerror = () => reject(new Error("Erro ao carregar foto do cliente"));
            clientImg.src = photoUrl;
          });

          const aspectRatio = clientImg.naturalWidth / clientImg.naturalHeight;
          const areaAspect = area.width / area.height;
          
          let sourceX = 0;
          let sourceY = 0;
          let sourceWidth = clientImg.naturalWidth;
          let sourceHeight = clientImg.naturalHeight;

          if (aspectRatio > areaAspect) {
            sourceWidth = clientImg.naturalHeight * areaAspect;
            sourceX = (clientImg.naturalWidth - sourceWidth) / 2;
          } else {
            sourceHeight = clientImg.naturalWidth / areaAspect;
            sourceY = (clientImg.naturalHeight - sourceHeight) / 2;
          }

          if (area.rotation && area.rotation !== 0) {
            ctx.save();
            const centerX = area.x + area.width / 2;
            const centerY = area.y + area.height / 2;
            ctx.translate(centerX, centerY);
            ctx.rotate((area.rotation * Math.PI) / 180);
            ctx.drawImage(
              clientImg,
              sourceX,
              sourceY,
              sourceWidth,
              sourceHeight,
              -area.width / 2,
              -area.height / 2,
              area.width,
              area.height
            );
            ctx.restore();
          } else {
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
          }
        }
      }

      // Gerar diferentes formatos
      const novosResultados: ResultadoTeste[] = [];

      // 1. PNG RGB padrão (toBlob quality 1.0)
      const pngBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });
      novosResultados.push({
        formato: "PNG RGB (padrão)",
        url: URL.createObjectURL(pngBlob),
        tamanho: formatBytes(pngBlob.size),
        blob: pngBlob,
      });

      // 2. PNG RGB via DataURL (sem compressão adicional)
      const pngDataUrl = canvas.toDataURL("image/png", 1.0);
      const pngDataBlob = await fetch(pngDataUrl).then(r => r.blob());
      novosResultados.push({
        formato: "PNG RGB (DataURL)",
        url: pngDataUrl,
        tamanho: formatBytes(pngDataBlob.size),
        blob: pngDataBlob,
      });

      // 3. JPEG 100% qualidade
      const jpegBlob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/jpeg", 1.0);
      });
      novosResultados.push({
        formato: "JPEG 100%",
        url: URL.createObjectURL(jpegBlob),
        tamanho: formatBytes(jpegBlob.size),
        blob: jpegBlob,
      });

      setResultados(novosResultados);
      toast.success("Mockups gerados com sucesso! Compare os resultados abaixo.");

    } catch (error: any) {
      console.error("Erro ao gerar mockup:", error);
      toast.error(`Erro ao gerar mockup: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  const handleDownload = (resultado: ResultadoTeste) => {
    const a = document.createElement("a");
    a.href = resultado.url;
    a.download = `teste_${resultado.formato.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${resultado.formato.includes('JPEG') ? 'jpg' : 'png'}`;
    a.click();
    toast.success(`Download iniciado: ${resultado.formato}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Testar Exportação de Mockups</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="bg-muted/50 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Esta ferramenta permite testar diferentes formatos de exportação de mockups "Molde" 
              para comparar qualidade de cores. O Canvas HTML só suporta RGB - para CMYK real, 
              seria necessário conversão via edge function.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Pedido</label>
              <Select
                value={pedidoSelecionado}
                onValueChange={handlePedidoChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um pedido" />
                </SelectTrigger>
                <SelectContent>
                  {pedidos.map((pedido) => (
                    <SelectItem key={pedido.id} value={pedido.id}>
                      #{pedido.numero_pedido} - {pedido.codigo_produto}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Mockup (Molde)</label>
              <Select
                value={mockupSelecionado}
                onValueChange={setMockupSelecionado}
                disabled={!pedidoSelecionado || mockups.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mockup" />
                </SelectTrigger>
                <SelectContent>
                  {mockups.map((mockup) => (
                    <SelectItem key={mockup.id} value={mockup.id}>
                      {mockup.codigo_mockup} ({mockup.mockup_canvases?.length || 0} canvas)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => carregarPedidos()}
              variant="outline"
              disabled={carregando}
            >
              Carregar Pedidos
            </Button>
            <Button
              onClick={gerarMockupTeste}
              disabled={!pedidoSelecionado || !mockupSelecionado || carregando}
              className="flex-1"
            >
              {carregando ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Gerando...
                </>
              ) : (
                "Gerar Testes de Exportação"
              )}
            </Button>
          </div>

          {resultados.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">Resultados</h3>
              
              <div className="grid grid-cols-3 gap-4">
                {resultados.map((resultado, index) => (
                  <div key={index} className="border rounded-lg p-4 space-y-3">
                    <div className="text-center">
                      <h4 className="font-medium text-sm mb-1">{resultado.formato}</h4>
                      <p className="text-xs text-muted-foreground">
                        Tamanho: {resultado.tamanho}
                      </p>
                    </div>
                    
                    <div className="aspect-square border rounded overflow-hidden bg-muted">
                      <img
                        src={resultado.url}
                        alt={resultado.formato}
                        className="w-full h-full object-contain"
                      />
                    </div>

                    <Button
                      onClick={() => handleDownload(resultado)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      <Download className="mr-2 h-3 w-3" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="font-medium text-sm mb-2 text-blue-900 dark:text-blue-100">
                  Como comparar:
                </h4>
                <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                  <li>Baixe todos os formatos gerados acima</li>
                  <li>Abra as imagens no CorelDRAW ou software de sua preferência</li>
                  <li>Compare as cores com a sua exportação manual do Corel</li>
                  <li>Verifique qual formato apresenta cores mais próximas</li>
                  <li>Considere que todos são RGB - CMYK real precisaria edge function</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
