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

// Normaliza o path para comparação consistente
const normalizePath = (path: string): string => {
  try {
    return decodeURIComponent(path).toLowerCase().trim();
  } catch {
    return path.toLowerCase().trim();
  }
};

// Extrai o path do storage de uma URL
const extractPath = (url: string): string | null => {
  const parts = url.split("/mockup-images/");
  if (parts.length === 2) {
    try {
      return decodeURIComponent(parts[1]);
    } catch {
      return parts[1];
    }
  }
  return null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Cleanup] Iniciando limpeza de arquivos órfãos...");

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
          if (file.name && !file.name.startsWith(".")) {
            allStorageFiles.push(`${folder}/${file.name}`);
          }
        });
      }
    }

    console.log(`[Cleanup] Total de arquivos no storage: ${allStorageFiles.length}`);

    // Buscar todas as URLs referenciadas no banco
    const referencedPaths = new Set<string>();

    // 1. URLs dos pedidos
    const { data: pedidos, error: pedidosError } = await supabase
      .from("pedidos")
      .select("fotos_cliente, foto_aprovacao, molde_producao");

    if (pedidosError) {
      throw new Error(`Erro ao buscar pedidos: ${pedidosError.message}`);
    }

    pedidos?.forEach((pedido: any) => {
      if (pedido.fotos_cliente) {
        pedido.fotos_cliente.forEach((url: string) => {
          const path = extractPath(url);
          if (path) referencedPaths.add(normalizePath(path));
        });
      }
      if (pedido.foto_aprovacao) {
        pedido.foto_aprovacao.forEach((url: string) => {
          const path = extractPath(url);
          if (path) referencedPaths.add(normalizePath(path));
        });
      }
      if (pedido.molde_producao) {
        pedido.molde_producao.forEach((url: string) => {
          const path = extractPath(url);
          if (path) referencedPaths.add(normalizePath(path));
        });
      }
    });

    console.log(`[Cleanup] Paths referenciados em pedidos: ${referencedPaths.size}`);

    // 2. URLs dos mockup_canvases (CRÍTICO - imagens base dos mockups)
    const { data: canvases, error: canvasesError } = await supabase
      .from("mockup_canvases")
      .select("imagem_base");

    if (canvasesError) {
      throw new Error(`Erro ao buscar canvases: ${canvasesError.message}`);
    }

    canvases?.forEach((canvas: any) => {
      if (canvas.imagem_base) {
        const path = extractPath(canvas.imagem_base);
        if (path) {
          referencedPaths.add(normalizePath(path));
          console.log(`[Cleanup] Canvas referencia: ${path}`);
        }
      }
    });

    console.log(`[Cleanup] Paths após mockup_canvases: ${referencedPaths.size}`);

    // 3. URLs dos mockups (imagem_base legado)
    const { data: mockups, error: mockupsError } = await supabase
      .from("mockups")
      .select("imagem_base");

    if (mockupsError) {
      throw new Error(`Erro ao buscar mockups: ${mockupsError.message}`);
    }

    mockups?.forEach((mockup: any) => {
      if (mockup.imagem_base) {
        const path = extractPath(mockup.imagem_base);
        if (path) {
          referencedPaths.add(normalizePath(path));
        }
      }
    });

    console.log(`[Cleanup] Total de paths referenciados: ${referencedPaths.size}`);

    // Identificar arquivos órfãos
    const orphanFiles: OrphanFile[] = [];
    const protectedFiles: string[] = [];

    for (const filePath of allStorageFiles) {
      const normalizedFilePath = normalizePath(filePath);
      const isReferenced = referencedPaths.has(normalizedFilePath);

      // PROTEÇÃO EXTRA: Arquivos na pasta mockups/ recebem verificação dupla
      if (filePath.startsWith("mockups/") && !isReferenced) {
        // Buscar diretamente no banco se existe alguma referência com ILIKE
        const { count, error: countError } = await supabase
          .from("mockup_canvases")
          .select("id", { count: "exact", head: true })
          .ilike("imagem_base", `%${filePath}%`);

        if (countError) {
          console.error(`[Cleanup] Erro ao verificar ${filePath}:`, countError);
          // Em caso de erro, NÃO marcar como órfão (segurança)
          protectedFiles.push(filePath);
          continue;
        }

        if (count && count > 0) {
          console.log(`[Cleanup] PROTEGIDO: ${filePath} tem ${count} referência(s) no banco`);
          protectedFiles.push(filePath);
          continue;
        }

        // Verificar também na tabela mockups
        const { count: mockupCount, error: mockupCountError } = await supabase
          .from("mockups")
          .select("id", { count: "exact", head: true })
          .ilike("imagem_base", `%${filePath}%`);

        if (mockupCountError) {
          console.error(`[Cleanup] Erro ao verificar mockups ${filePath}:`, mockupCountError);
          protectedFiles.push(filePath);
          continue;
        }

        if (mockupCount && mockupCount > 0) {
          console.log(`[Cleanup] PROTEGIDO: ${filePath} tem ${mockupCount} referência(s) em mockups`);
          protectedFiles.push(filePath);
          continue;
        }

        console.log(`[Cleanup] ÓRFÃO CONFIRMADO (mockups/): ${filePath}`);
      }

      if (!isReferenced && !protectedFiles.includes(filePath)) {
        orphanFiles.push({
          path: filePath,
          size: 0,
          lastModified: "",
        });
      }
    }

    console.log(`[Cleanup] Arquivos órfãos identificados: ${orphanFiles.length}`);
    console.log(`[Cleanup] Arquivos protegidos: ${protectedFiles.length}`);

    // Verificar se é uma requisição para apenas contar ou para deletar
    const { action } = await req.json().catch(() => ({ action: "count" }));

    if (action === "delete" && orphanFiles.length > 0) {
      // Deletar arquivos órfãos em lotes de 100
      const batchSize = 100;
      let deleted = 0;

      for (let i = 0; i < orphanFiles.length; i += batchSize) {
        const batch = orphanFiles.slice(i, i + batchSize).map((f) => f.path);
        
        console.log(`[Cleanup] Deletando lote ${Math.floor(i / batchSize) + 1}:`, batch.slice(0, 5));
        
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
          protectedCount: protectedFiles.length,
          orphanFiles: orphanFiles.slice(0, 50),
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
        referencedFiles: referencedPaths.size,
        protectedCount: protectedFiles.length,
        orphanFiles: orphanFiles.slice(0, 50),
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
