import { supabase } from "@/integrations/supabase/client";

/**
 * Extrai o path de uma URL do Storage Supabase
 * Ex: https://[...]/storage/v1/object/public/mockup-images/clientes/abc.png -> clientes/abc.png
 */
export function extractStoragePath(url: string): string | null {
  if (!url) return null;
  
  const parts = url.split("/mockup-images/");
  if (parts.length === 2) {
    return parts[1];
  }
  
  // Fallback: tentar extrair apenas o nome do arquivo
  const fileName = url.split("/").pop();
  return fileName || null;
}

/**
 * Deleta todos os arquivos de Storage associados a um pedido
 */
export async function deletePedidoStorageFiles(pedido: any): Promise<void> {
  const filesToDelete: string[] = [];

  // Fotos do cliente (pasta clientes/)
  if (pedido.fotos_cliente && Array.isArray(pedido.fotos_cliente)) {
    pedido.fotos_cliente.forEach((url: string) => {
      const path = extractStoragePath(url);
      if (path && !path.includes("clientes/")) {
        filesToDelete.push(`clientes/${path}`);
      } else if (path) {
        filesToDelete.push(path);
      }
    });
  }

  // Fotos de aprovação (pasta aprovacao/)
  if (pedido.foto_aprovacao && Array.isArray(pedido.foto_aprovacao)) {
    pedido.foto_aprovacao.forEach((url: string) => {
      const path = extractStoragePath(url);
      if (path && !path.includes("aprovacao/")) {
        filesToDelete.push(`aprovacao/${path}`);
      } else if (path) {
        filesToDelete.push(path);
      }
    });
  }

  // Moldes de produção (pasta molde/)
  if (pedido.molde_producao && Array.isArray(pedido.molde_producao)) {
    pedido.molde_producao.forEach((url: string) => {
      const path = extractStoragePath(url);
      if (path && !path.includes("molde/")) {
        filesToDelete.push(`molde/${path}`);
      } else if (path) {
        filesToDelete.push(path);
      }
    });
  }

  // Deletar arquivos do Storage
  if (filesToDelete.length > 0) {
    console.log(`[Storage] Deletando ${filesToDelete.length} arquivo(s) do pedido ${pedido.numero_pedido}`);
    const { error } = await supabase.storage
      .from("mockup-images")
      .remove(filesToDelete);
    
    if (error) {
      console.error("[Storage] Erro ao deletar arquivos:", error);
      throw error;
    }
  }
}

/**
 * Deleta imagens de um mockup (canvas)
 */
export async function deleteMockupStorageFiles(mockupId: string): Promise<void> {
  try {
    // Buscar todos os canvas do mockup
    const { data: canvases, error: canvasError } = await supabase
      .from("mockup_canvases")
      .select("imagem_base")
      .eq("mockup_id", mockupId);

    if (canvasError) throw canvasError;
    if (!canvases || canvases.length === 0) return;

    const filesToDelete: string[] = [];

    // Extrair paths das imagens base dos canvas
    canvases.forEach((canvas) => {
      if (canvas.imagem_base) {
        const path = extractStoragePath(canvas.imagem_base);
        if (path) {
          filesToDelete.push(path);
        }
      }
    });

    // Deletar arquivos do Storage
    if (filesToDelete.length > 0) {
      console.log(`[Storage] Deletando ${filesToDelete.length} imagem(ns) do mockup`);
      const { error } = await supabase.storage
        .from("mockup-images")
        .remove(filesToDelete);
      
      if (error) {
        console.error("[Storage] Erro ao deletar imagens:", error);
        throw error;
      }
    }
  } catch (error) {
    console.error("[Storage] Erro ao processar deleção de mockup:", error);
    throw error;
  }
}
