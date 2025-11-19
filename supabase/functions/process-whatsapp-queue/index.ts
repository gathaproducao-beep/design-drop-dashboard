import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para aguardar um tempo específico
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Função para gerar delay randômico entre min e max
const getRandomDelay = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Iniciando processamento da fila WhatsApp');

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar configurações de delay
    const { data: settings } = await supabase
      .from('whatsapp_settings')
      .select('delay_minimo, delay_maximo')
      .single();

    const delayMinimo = settings?.delay_minimo || 5;
    const delayMaximo = settings?.delay_maximo || 15;

    console.log(`Delay configurado: ${delayMinimo}s - ${delayMaximo}s`);

    // 2. Buscar mensagens pendentes
    const { data: messages, error: messagesError } = await supabase
      .from('whatsapp_queue')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString())
      .order('created_at', { ascending: true })
      .limit(10); // Processar no máximo 10 por execução

    if (messagesError) {
      console.error('Erro ao buscar mensagens:', messagesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar mensagens' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!messages || messages.length === 0) {
      console.log('Nenhuma mensagem pendente');
      return new Response(
        JSON.stringify({ success: true, processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando ${messages.length} mensagens`);

    let processedCount = 0;
    let successCount = 0;
    let failedCount = 0;

    // 3. Buscar instâncias ativas dinamicamente (ordenadas por prioridade)
    const { data: instances } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('is_active', true)
      .order('ordem', { ascending: true });

    if (!instances || instances.length === 0) {
      console.error('Nenhuma instância ativa encontrada');
      return new Response(
        JSON.stringify({ error: 'Nenhuma instância ativa encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const activeInstance = instances[0]; // Usar a primeira instância ativa (maior prioridade)
    console.log(`Usando instância: ${activeInstance.nome}`);

    // 4. Processar cada mensagem
    for (const msg of messages) {
      try {
        // Marcar como processando
        await supabase
          .from('whatsapp_queue')
          .update({ status: 'processing' })
          .eq('id', msg.id);

        console.log(`Processando mensagem ${msg.id} para ${msg.phone}`);

        // Tentar enviar usando instância ativa
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { 
            phone: msg.phone, 
            message: msg.message,
            instance_id: activeInstance.id
          }
        });

        if (error || !data?.success) {
          // Falha no envio
          const newAttempts = msg.attempts + 1;
          
          if (newAttempts >= msg.max_attempts) {
            // Máximo de tentativas atingido - marcar como falha
            await supabase
              .from('whatsapp_queue')
              .update({ 
                status: 'failed',
                attempts: newAttempts,
                error_message: error?.message || data?.error || 'Falha após múltiplas tentativas'
              })
              .eq('id', msg.id);
            
            // Atualizar status do pedido para "erro" se tiver pedido_id
            if (msg.pedido_id) {
              await supabase
                .from('pedidos')
                .update({ mensagem_enviada: 'erro' })
                .eq('id', msg.pedido_id);
            }
            
            console.log(`Mensagem ${msg.id} falhou após ${newAttempts} tentativas`);
            failedCount++;
          } else {
            // Reagendar para nova tentativa
            await supabase
              .from('whatsapp_queue')
              .update({ 
                status: 'pending',
                attempts: newAttempts,
                error_message: error?.message || data?.error,
                scheduled_at: new Date(Date.now() + 60000).toISOString() // Tentar novamente em 1 minuto
              })
              .eq('id', msg.id);
            
            console.log(`Mensagem ${msg.id} reagendada (tentativa ${newAttempts})`);
          }
        } else {
          // Sucesso
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              attempts: msg.attempts + 1
            })
            .eq('id', msg.id);
          
          // Atualizar status do pedido para "enviada" se tiver pedido_id
          if (msg.pedido_id) {
            await supabase
              .from('pedidos')
              .update({ mensagem_enviada: 'enviada' })
              .eq('id', msg.pedido_id);
          }
          
          console.log(`Mensagem ${msg.id} enviada com sucesso`);
          successCount++;
        }

        processedCount++;

        // Aplicar delay antes da próxima mensagem (exceto na última)
        if (processedCount < messages.length) {
          const delaySeconds = getRandomDelay(delayMinimo, delayMaximo);
          console.log(`Aguardando ${delaySeconds}s antes da próxima mensagem...`);
          await sleep(delaySeconds * 1000);
        }

      } catch (error) {
        console.error(`Erro ao processar mensagem ${msg.id}:`, error);
        
        // Marcar como erro e reagendar se possível
        const newAttempts = msg.attempts + 1;
        const errorMessage = error instanceof Error ? error.message : String(error);
        await supabase
          .from('whatsapp_queue')
          .update({ 
            status: newAttempts >= msg.max_attempts ? 'failed' : 'pending',
            attempts: newAttempts,
            error_message: errorMessage,
            scheduled_at: newAttempts >= msg.max_attempts ? null : new Date(Date.now() + 60000).toISOString()
          })
          .eq('id', msg.id);
        
        failedCount++;
      }
    }

    console.log(`Processamento concluído: ${successCount} enviadas, ${failedCount} falharam`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: processedCount,
        sent: successCount,
        failed: failedCount
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro interno:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
