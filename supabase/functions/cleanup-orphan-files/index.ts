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
// Apenas lowercase e trim, sem decodificação que pode causar problemas
const normalizePath = (path: string): string => {
  return path.toLowerCase().trim();
};

// Extrai o path do storage de uma URL
const extractPath = (url: string): string | null => {
  if (!url) return null;
  
  const parts = url.split("/mockup-images/");
  if (parts.length === 2) {
    // Retornar sem decodificar - manter consistência com o storage
    return parts[1];
  }
  return null;
};

// Extrai múltiplas variações possíveis de path para comparação
const extractPathVariations = (url: string): string[] => {
  if (!url) return [];
  
  const variations: string[] = [];
  
  const parts = url.split("/mockup-images/");
  if (parts.length === 2) {
    const rawPath = parts[1];
    variations.push(normalizePath(rawPath));
    
    // Tentar decodificar e adicionar variação
    try {
      const decoded = decodeURIComponent(rawPath);
      if (decoded !== rawPath) {
        variations.push(normalizePath(decoded));
      }
    } catch {
      // Ignorar erros de decodificação
    }
    
    // Variação com espaços substituídos por %20
    const encoded = rawPath.replace(/ /g, '%20');
    if (encoded !== rawPath) {
      variations.push(normalizePath(encoded));
    }
  }
  
  return variations;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[Cleanup] Iniciando análise de arquivos órfãos...");

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
    // Usar Set com variações de paths para comparação robusta
    const referencedPaths = new Set<string>();
    
    // Set específico para fotos_cliente (proteção extra)
    const clientePhotoPaths = new Set<string>();

    // 1. URLs dos pedidos
    const { data: pedidos, error: pedidosError } = await supabase
      .from("pedidos")
      .select("id, numero_pedido, fotos_cliente, foto_aprovacao, molde_producao");

    if (pedidosError) {
      throw new Error(`Erro ao buscar pedidos: ${pedidosError.message}`);
    }

    console.log(`[Cleanup] Total de pedidos no banco: ${pedidos?.length || 0}`);

    pedidos?.forEach((pedido: any) => {
      // Fotos do cliente - PROTEÇÃO ESPECIAL
      if (pedido.fotos_cliente && Array.isArray(pedido.fotos_cliente)) {
        pedido.fotos_cliente.forEach((url: string) => {
          const variations = extractPathVariations(url);
          variations.forEach(p => {
            referencedPaths.add(p);
            clientePhotoPaths.add(p);
          });
          // Log detalhado para debug
          if (variations.length > 0) {
            console.log(`[Cleanup] Pedido ${pedido.numero_pedido} - foto_cliente protegida: ${variations[0]}`);
          }
        });
      }
      // Fotos de aprovação
      if (pedido.foto_aprovacao && Array.isArray(pedido.foto_aprovacao)) {
        pedido.foto_aprovacao.forEach((url: string) => {
          extractPathVariations(url).forEach(p => referencedPaths.add(p));
        });
      }
      // Moldes de produção
      if (pedido.molde_producao && Array.isArray(pedido.molde_producao)) {
        pedido.molde_producao.forEach((url: string) => {
          extractPathVariations(url).forEach(p => referencedPaths.add(p));
        });
      }
    });
    
    console.log(`[Cleanup] Fotos de cliente protegidas: ${clientePhotoPaths.size}`);

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
        extractPathVariations(canvas.imagem_base).forEach(p => referencedPaths.add(p));
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
        extractPathVariations(mockup.imagem_base).forEach(p => referencedPaths.add(p));
      }
    });

    console.log(`[Cleanup] Total de paths referenciados: ${referencedPaths.size}`);

    // Identificar arquivos órfãos
    const orphanFiles: OrphanFile[] = [];
    const protectedFiles: string[] = [];

    for (const filePath of allStorageFiles) {
      const normalizedFilePath = normalizePath(filePath);
      const isReferenced = referencedPaths.has(normalizedFilePath);
      
      // Verificar se é uma foto_cliente referenciada (verificação extra)
      const isClientePhoto = clientePhotoPaths.has(normalizedFilePath);

      // PROTEÇÃO: Arquivos na pasta clientes/ NUNCA são considerados órfãos
      // Estes são as fotos originais dos clientes e devem ser protegidas
      if (filePath.startsWith("clientes/")) {
        console.log(`[Cleanup] PROTEGIDO (pasta clientes/): ${filePath}`);
        protectedFiles.push(filePath);
        continue;
      }
      
      // PROTEÇÃO EXTRA: Se é uma foto_cliente referenciada em qualquer pedido
      if (isClientePhoto) {
        console.log(`[Cleanup] PROTEGIDO (foto_cliente referenciada): ${filePath}`);
        protectedFiles.push(filePath);
        continue;
      }

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
