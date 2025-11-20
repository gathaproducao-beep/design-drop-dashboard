import { supabase } from "@/integrations/supabase/client";

export interface MockupGenerationResult {
  aprovacao?: string[];
  molde?: string[];
}

// Funções utilitárias para PNG com 300 DPI
const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getIHDRDimensions(pngData: Uint8Array): { width: number; height: number } {
  const widthBytes = pngData.slice(16, 20);
  const heightBytes = pngData.slice(20, 24);
  const width = new DataView(widthBytes.buffer).getUint32(0, false);
  const height = new DataView(heightBytes.buffer).getUint32(0, false);
  return { width, height };
}

function setPHYsTo300DPI(pngData: Uint8Array): Uint8Array {
  const ppm = 11811; // 300 DPI em pixels por metro
  const result: number[] = [];
  let pos = 8;

  result.push(...Array.from(pngData.slice(0, 8)));

  while (pos < pngData.length) {
    const lengthBytes = pngData.slice(pos, pos + 4);
    const length = new DataView(lengthBytes.buffer).getUint32(0, false);
    const type = String.fromCharCode(...pngData.slice(pos + 4, pos + 8));

    if (type === "IEND") {
      const physChunk = [
        0, 0, 0, 9,
        ...[0x70, 0x48, 0x59, 0x73],
        ...[
          (ppm >> 24) & 0xff,
          (ppm >> 16) & 0xff,
          (ppm >> 8) & 0xff,
          ppm & 0xff,
        ],
        ...[
          (ppm >> 24) & 0xff,
          (ppm >> 16) & 0xff,
          (ppm >> 8) & 0xff,
          ppm & 0xff,
        ],
        1,
      ];
      const physData = new Uint8Array(physChunk.slice(4));
      const physCrc = crc32(physData);
      physChunk.push(
        (physCrc >> 24) & 0xff,
        (physCrc >> 16) & 0xff,
        (physCrc >> 8) & 0xff,
        physCrc & 0xff
      );

      result.push(...physChunk);
      result.push(...Array.from(pngData.slice(pos)));
      break;
    } else if (type === "pHYs") {
      pos += 12 + length;
      continue;
    } else {
      result.push(...Array.from(pngData.slice(pos, pos + 12 + length)));
      pos += 12 + length;
    }
  }

  return new Uint8Array(result);
}

export async function generateMockupsForPedido(
  pedido: any,
  tipoGerar: 'all' | 'aprovacao' | 'molde' = 'all',
  onProgress?: (message: string) => void
): Promise<MockupGenerationResult> {
  try {
    onProgress?.('Buscando configuração de mockups...');

    // Buscar mockups principais
    const { data: mockupsPrincipais, error: mockupError } = await supabase
      .from("mockups")
      .select(`
        *,
        mockup_canvases(
          *,
          mockup_areas(*)
        )
      `)
      .eq("codigo_mockup", pedido.codigo_produto)
      .order("tipo", { ascending: true });

    if (mockupError) throw mockupError;

    let mockups = mockupsPrincipais || [];

    // Se houver mockup de molde vinculado a um de aprovação, buscar também
    const mockupPrincipal = mockups[0];
    if (mockupPrincipal?.mockup_aprovacao_vinculado_id) {
      const { data: mockupAprovacao, error: aprovacaoError } = await supabase
        .from("mockups")
        .select(`
          *,
          mockup_canvases(
            *,
            mockup_areas(*)
          )
        `)
        .eq("id", mockupPrincipal.mockup_aprovacao_vinculado_id)
        .single();

      if (!aprovacaoError && mockupAprovacao) {
        mockups = [mockupAprovacao, ...mockupsPrincipais];
      }
    }

    // Filtrar mockups baseado no tipoGerar
    if (tipoGerar === 'aprovacao') {
      mockups = mockups.filter(m => m.tipo === 'aprovacao');
    } else if (tipoGerar === 'molde') {
      mockups = mockups.filter(m => m.tipo === 'molde');
    }

    if (mockups.length === 0) {
      onProgress?.('Mockup não configurado - usando foto do cliente');
      
      // Atualizar com foto do cliente se não houver mockup configurado
      if (tipoGerar === 'aprovacao' || tipoGerar === 'all') {
        const fotoCliente = pedido.fotos_cliente?.[0];
        if (fotoCliente) {
          await supabase
            .from('pedidos')
            .update({ 
              foto_aprovacao: [fotoCliente],
              layout_aprovado: 'pendente'
            })
            .eq('id', pedido.id);
          
          return { aprovacao: [fotoCliente] };
        }
      }
      
      return {};
    }

    // Processar cada mockup
    const results: MockupGenerationResult = {};
    const aprovacaoUrls: string[] = [];
    const moldeUrls: string[] = [];

    for (const mockup of mockups) {
      onProgress?.(`Gerando ${mockup.tipo}: ${mockup.codigo_mockup}...`);
      
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
        const ctx = canvas.getContext("2d", { 
          alpha: true,
          willReadFrequently: false 
        });
        if (!ctx) continue;

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

        canvas.width = Math.round(baseImg.naturalWidth);
        canvas.height = Math.round(baseImg.naturalHeight);
        canvas.style.width = `${canvas.width}px`;
        canvas.style.height = `${canvas.height}px`;
        
        ctx.drawImage(baseImg, 0, 0, canvas.width, canvas.height);

        // Processar cada área
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
              clientImg.onerror = reject;
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

            // Aplicar rotação se houver
            if (area.rotation && area.rotation !== 0) {
              ctx.save();
              
              // Transladar para o centro da área
              const centerX = area.x + area.width / 2;
              const centerY = area.y + area.height / 2;
              ctx.translate(centerX, centerY);
              
              // Rotacionar (converter de graus para radianos)
              ctx.rotate((area.rotation * Math.PI) / 180);
              
              // Desenhar com coordenadas ajustadas (relativas ao centro)
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
              // Desenhar normalmente sem rotação
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
          } else if (area.kind === "text") {
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
              
              // Aplicar rotação se houver
              if (area.rotation && area.rotation !== 0) {
                const centerX = area.x + area.width / 2;
                const centerY = area.y + area.height / 2;
                ctx.translate(centerX, centerY);
                ctx.rotate((area.rotation * Math.PI) / 180);
                
                // Configurar texto
                ctx.font = `${area.font_weight || "normal"} ${area.font_size || 16}px ${area.font_family || "Arial"}`;
                ctx.fillStyle = area.color || "#000000";
                ctx.textAlign = (area.text_align || "left") as CanvasTextAlign;
                
                // Ajustar coordenadas do texto relativas ao centro
                let textX = -area.width / 2;
                if (area.text_align === "center") textX = 0;
                else if (area.text_align === "right") textX = area.width / 2;
                
                ctx.fillText(textValue, textX, (area.font_size || 16) / 3);
              } else {
                // Desenhar texto normalmente sem rotação
                ctx.font = `${area.font_weight || "normal"} ${area.font_size || 16}px ${area.font_family || "Arial"}`;
                ctx.fillStyle = area.color || "#000000";
                ctx.textAlign = (area.text_align || "left") as CanvasTextAlign;
                
                let textX = area.x;
                if (area.text_align === "center") textX = area.x + area.width / 2;
                else if (area.text_align === "right") textX = area.x + area.width;

                ctx.fillText(textValue, textX, area.y + (area.font_size || 16));
              }
              
              ctx.restore();
            }
          }
        }

        // Converter canvas para blob
        const blob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((b) => {
            if (!b) {
              resolve(new Blob());
              return;
            }
            resolve(b);
          }, "image/png", 1.0);
        });

        // Processar PNG para adicionar 300 DPI
        const arrayBuffer = await blob.arrayBuffer();
        let pngData = new Uint8Array(arrayBuffer);
        const dimensions = getIHDRDimensions(pngData);
        const processedPngData = setPHYsTo300DPI(pngData);
        // Criar novo ArrayBuffer a partir do processedPngData
        const newBuffer = new ArrayBuffer(processedPngData.length);
        const newArray = new Uint8Array(newBuffer);
        newArray.set(processedPngData);
        const processedBlob = new Blob([newArray], { type: "image/png" });

        // Upload para storage
        const timestamp = Date.now();
        const filename = `${pedido.numero_pedido}_${mockup.tipo}_${canvasData.nome}_${timestamp}.png`;
        const filepath = `${mockup.tipo}/${filename}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("mockup-images")
          .upload(filepath, processedBlob, {
            contentType: "image/png",
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("mockup-images")
          .getPublicUrl(uploadData.path);

        if (mockup.tipo === "aprovacao") {
          aprovacaoUrls.push(urlData.publicUrl);
        } else {
          moldeUrls.push(urlData.publicUrl);
        }
      }
    }

    // Preparar resultado
    if (aprovacaoUrls.length > 0) results.aprovacao = aprovacaoUrls;
    if (moldeUrls.length > 0) results.molde = moldeUrls;

    // Atualizar pedido no banco
    onProgress?.('Salvando mockups gerados...');
    const updateData: any = {};
    
    if (results.aprovacao) {
      updateData.foto_aprovacao = results.aprovacao;
      updateData.layout_aprovado = 'pendente';
    }
    if (results.molde) {
      updateData.molde_producao = results.molde;
    }

    if (Object.keys(updateData).length > 0) {
      await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', pedido.id);
    }

    // Verificar se deve enviar mensagem automaticamente
    if (results.aprovacao && results.aprovacao.length > 0) {
      // Buscar configuração de auto-envio
      const { data: settings } = await supabase
        .from('whatsapp_settings')
        .select('auto_send_enabled')
        .single();
      
      // Se auto-envio estiver ativo E mensagem ainda não foi enviada
      if (settings?.auto_send_enabled && pedido.mensagem_enviada !== 'enviada') {
        try {
          onProgress?.('Adicionando mensagem à fila de envio...');
          
          // Importar função de envio
          const { processarEnvioPedido } = await import('./whatsapp');
          
          // Adicionar à fila (não aguarda para não bloquear)
          processarEnvioPedido(pedido.id).catch((error) => {
            console.error('Erro ao adicionar mensagem à fila:', error);
            // Não lança erro para não interromper o fluxo de geração
          });
          
          onProgress?.('Mensagem adicionada à fila de envio!');
        } catch (error) {
          console.error('Erro ao processar envio automático:', error);
          // Continua mesmo com erro no envio
        }
      }
    }

    onProgress?.('Concluído!');
    return results;

  } catch (error) {
    console.error('Erro ao gerar mockup:', error);
    throw error;
  }
}
