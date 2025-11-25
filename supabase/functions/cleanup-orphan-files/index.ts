import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OrphanFile {
  path: string;
  size: number;
  lastModified: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Cleanup] Iniciando limpeza de arquivos órfãos...");

    // Listar todos os arquivos no bucket mockup-images
    const { data: allFiles, error: listError } = await supabase.storage
      .from("mockup-images")
      .list("", {
        limit: 10000,
        sortBy: { column: "name", order: "asc" },
      });

    if (listError) {
      throw new Error(`Erro ao listar arquivos: ${listError.message}`);
    }

    console.log(`[Cleanup] Total de arquivos encontrados: ${allFiles?.length || 0}`);

    // Listar arquivos em subpastas
    const folders = ["clientes", "aprovacao", "molde", "mockups"];
    const allStorageFiles: string[] = [];

    for (const folder of folders) {
      const { data: folderFiles, error: folderError } = await supabase.storage
        .from("mockup-images")
        .list(folder, {
          limit: 10000,
        });

      if (folderError) {
        console.error(`[Cleanup] Erro ao listar pasta ${folder}:`, folderError);
        continue;
      }

      if (folderFiles) {
        folderFiles.forEach((file) => {
          allStorageFiles.push(`${folder}/${file.name}`);
        });
      }
    }

    console.log(`[Cleanup] Total de arquivos em subpastas: ${allStorageFiles.length}`);

    // Buscar todas as URLs referenciadas no banco
    const referencedUrls = new Set<string>();

    // 1. URLs dos pedidos
    const { data: pedidos, error: pedidosError } = await supabase
      .from("pedidos")
      .select("fotos_cliente, foto_aprovacao, molde_producao");

    if (pedidosError) {
      throw new Error(`Erro ao buscar pedidos: ${pedidosError.message}`);
    }

    pedidos?.forEach((pedido: any) => {
      if (pedido.fotos_cliente) {
        pedido.fotos_cliente.forEach((url: string) => referencedUrls.add(url));
      }
      if (pedido.foto_aprovacao) {
        pedido.foto_aprovacao.forEach((url: string) => referencedUrls.add(url));
      }
      if (pedido.molde_producao) {
        pedido.molde_producao.forEach((url: string) => referencedUrls.add(url));
      }
    });

    console.log(`[Cleanup] URLs em pedidos: ${referencedUrls.size}`);

    // 2. URLs dos mockup_canvases
    const { data: canvases, error: canvasesError } = await supabase
      .from("mockup_canvases")
      .select("imagem_base");

    if (canvasesError) {
      throw new Error(`Erro ao buscar canvases: ${canvasesError.message}`);
    }

    canvases?.forEach((canvas: any) => {
      if (canvas.imagem_base) {
        referencedUrls.add(canvas.imagem_base);
      }
    });

    console.log(`[Cleanup] Total de URLs referenciadas: ${referencedUrls.size}`);

    // 3. Identificar arquivos órfãos
    const orphanFiles: OrphanFile[] = [];
    const extractPath = (url: string): string | null => {
      const parts = url.split("/mockup-images/");
      return parts.length === 2 ? decodeURIComponent(parts[1]) : null;
    };

    for (const filePath of allStorageFiles) {
      // Verificar se este path existe em alguma URL referenciada
      const isReferenced = Array.from(referencedUrls).some((url) => {
        const path = extractPath(url);
        return path === filePath;
      });

      if (!isReferenced) {
        orphanFiles.push({
          path: filePath,
          size: 0, // Poderia buscar metadata se necessário
          lastModified: "",
        });
      }
    }

    console.log(`[Cleanup] Arquivos órfãos identificados: ${orphanFiles.length}`);

    // Verificar se é uma requisição para apenas contar ou para deletar
    const { action } = await req.json().catch(() => ({ action: "count" }));

    if (action === "delete" && orphanFiles.length > 0) {
      // Deletar arquivos órfãos em lotes de 100
      const batchSize = 100;
      let deleted = 0;

      for (let i = 0; i < orphanFiles.length; i += batchSize) {
        const batch = orphanFiles.slice(i, i + batchSize).map((f) => f.path);
        const { error: deleteError } = await supabase.storage
          .from("mockup-images")
          .remove(batch);

        if (deleteError) {
          console.error(`[Cleanup] Erro ao deletar lote:`, deleteError);
        } else {
          deleted += batch.length;
        }
      }

      console.log(`[Cleanup] Arquivos deletados: ${deleted}`);

      return new Response(
        JSON.stringify({
          success: true,
          message: `${deleted} arquivos órfãos foram deletados`,
          deleted,
          orphanFiles: orphanFiles.slice(0, 50), // Retorna primeiros 50 para referência
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Retornar contagem
    return new Response(
      JSON.stringify({
        success: true,
        orphanCount: orphanFiles.length,
        totalFiles: allStorageFiles.length,
        referencedFiles: referencedUrls.size,
        orphanFiles: orphanFiles.slice(0, 50), // Retorna primeiros 50 para referência
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("[Cleanup] Erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
