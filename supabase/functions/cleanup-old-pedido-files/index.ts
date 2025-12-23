import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CleanupConfig {
  days: number;
  cleanupFotoAprovacao: boolean;
  cleanupMoldeProducao: boolean;
  dryRun?: boolean;
}

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  const parts = url.split("/mockup-images/");
  if (parts.length === 2) {
    return decodeURIComponent(parts[1]);
  }
  const fileName = url.split("/").pop();
  return fileName ? decodeURIComponent(fileName) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[cleanup-old-pedido-files] No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create client with user's auth token to verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error('[cleanup-old-pedido-files] Invalid user token:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[cleanup-old-pedido-files] Authenticated user: ${user.email}`);

    // Use service role client for operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const config: CleanupConfig = {
      days: body.days || 15,
      cleanupFotoAprovacao: body.cleanupFotoAprovacao ?? true,
      cleanupMoldeProducao: body.cleanupMoldeProducao ?? true,
      dryRun: body.dryRun ?? false,
    };

    console.log(`[Cleanup] Starting cleanup with config:`, config);

    // Calcular data limite
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - config.days);
    const cutoffDateStr = cutoffDate.toISOString().split("T")[0];

    console.log(`[Cleanup] Cutoff date: ${cutoffDateStr}`);

    // Buscar pedidos antigos que têm fotos para limpar
    let query = supabase
      .from("pedidos")
      .select("id, numero_pedido, data_pedido, foto_aprovacao, molde_producao")
      .lt("data_pedido", cutoffDateStr);

    // Filtrar apenas pedidos que têm as fotos que queremos limpar
    const conditions: string[] = [];
    if (config.cleanupFotoAprovacao) {
      conditions.push("foto_aprovacao.neq.[]");
      conditions.push("foto_aprovacao.not.is.null");
    }
    if (config.cleanupMoldeProducao) {
      conditions.push("molde_producao.neq.[]");
      conditions.push("molde_producao.not.is.null");
    }

    const { data: pedidos, error: queryError } = await query;

    if (queryError) {
      console.error("[Cleanup] Error fetching orders:", queryError);
      throw queryError;
    }

    // Filtrar pedidos que realmente têm arquivos para limpar
    const pedidosComArquivos = (pedidos || []).filter((p) => {
      const temFotoAprovacao = config.cleanupFotoAprovacao && 
        Array.isArray(p.foto_aprovacao) && p.foto_aprovacao.length > 0;
      const temMolde = config.cleanupMoldeProducao && 
        Array.isArray(p.molde_producao) && p.molde_producao.length > 0;
      return temFotoAprovacao || temMolde;
    });

    console.log(`[Cleanup] Found ${pedidosComArquivos.length} orders with files to clean`);

    // Coletar todos os arquivos para deletar
    const filesToDelete: string[] = [];
    const pedidosToUpdate: { id: string; numero_pedido: string }[] = [];

    for (const pedido of pedidosComArquivos) {
      let hasFilesToDelete = false;

      if (config.cleanupFotoAprovacao && Array.isArray(pedido.foto_aprovacao)) {
        for (const url of pedido.foto_aprovacao) {
          const path = extractStoragePath(url);
          if (path) {
            filesToDelete.push(path);
            hasFilesToDelete = true;
          }
        }
      }

      if (config.cleanupMoldeProducao && Array.isArray(pedido.molde_producao)) {
        for (const url of pedido.molde_producao) {
          const path = extractStoragePath(url);
          if (path) {
            filesToDelete.push(path);
            hasFilesToDelete = true;
          }
        }
      }

      if (hasFilesToDelete) {
        pedidosToUpdate.push({ id: pedido.id, numero_pedido: pedido.numero_pedido });
      }
    }

    console.log(`[Cleanup] Total files to delete: ${filesToDelete.length}`);

    // Se for dry run, retornar apenas o preview
    if (config.dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          summary: {
            pedidosCount: pedidosToUpdate.length,
            filesCount: filesToDelete.length,
            cutoffDate: cutoffDateStr,
            config,
          },
          pedidos: pedidosToUpdate.map((p) => p.numero_pedido),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Executar a limpeza
    let deletedFilesCount = 0;
    let updatedPedidosCount = 0;

    // Deletar arquivos do Storage em lotes
    if (filesToDelete.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < filesToDelete.length; i += batchSize) {
        const batch = filesToDelete.slice(i, i + batchSize);
        const { error: deleteError } = await supabase.storage
          .from("mockup-images")
          .remove(batch);

        if (deleteError) {
          console.error(`[Cleanup] Error deleting batch ${i}:`, deleteError);
        } else {
          deletedFilesCount += batch.length;
          console.log(`[Cleanup] Deleted batch ${i}-${i + batch.length}`);
        }
      }
    }

    // Atualizar os pedidos para limpar as referências
    for (const pedido of pedidosToUpdate) {
      const updateData: Record<string, unknown> = {};
      
      if (config.cleanupFotoAprovacao) {
        updateData.foto_aprovacao = [];
      }
      if (config.cleanupMoldeProducao) {
        updateData.molde_producao = [];
      }

      const { error: updateError } = await supabase
        .from("pedidos")
        .update(updateData)
        .eq("id", pedido.id);

      if (updateError) {
        console.error(`[Cleanup] Error updating order ${pedido.numero_pedido}:`, updateError);
      } else {
        updatedPedidosCount++;
      }
    }

    console.log(`[Cleanup] Completed: ${deletedFilesCount} files deleted, ${updatedPedidosCount} orders updated`);

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: false,
        summary: {
          pedidosUpdated: updatedPedidosCount,
          filesDeleted: deletedFilesCount,
          cutoffDate: cutoffDateStr,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[Cleanup] Error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});