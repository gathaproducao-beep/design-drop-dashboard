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

interface WhatsappInstance {
  id: string;
  nome: string;
  api_type: 'evolution' | 'oficial';
  evolution_api_url: string;
  evolution_api_key: string;
  evolution_instance: string;
  phone_number_id?: string;
  waba_id?: string;
  access_token?: string;
  is_active: boolean;
  ordem: number;
}

interface RotationState {
  currentInstanceId: string | null;
  messageCount: number;
}

// Função para obter índice da instância pelo ID
function getInstanceIndex(instances: WhatsappInstance[], instanceId: string | null): number {
  if (!instanceId) return 0;
  const idx = instances.findIndex(i => i.id === instanceId);
  return idx >= 0 ? idx : 0;
}

// Função para obter próxima instância na rotação
function getNextInstance(
  instances: WhatsappInstance[],
  state: RotationState,
  messagesPerInstance: number,
  forceRotate: boolean = false
): { instance: WhatsappInstance; newState: RotationState } {
  if (instances.length === 0) {
    throw new Error('Nenhuma instância disponível');
  }

  const currentIndex = getInstanceIndex(instances, state.currentInstanceId);

  // Se forçar rotação (erro) ou atingiu limite, ir para próxima
  if (forceRotate || state.messageCount >= messagesPerInstance) {
    const newIndex = (currentIndex + 1) % instances.length;
    return {
      instance: instances[newIndex],
      newState: { currentInstanceId: instances[newIndex].id, messageCount: 0 }
    };
  }

  return {
    instance: instances[currentIndex],
    newState: state
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Detectar origem da chamada (trigger, cron ou manual)
    const body = await req.json().catch(() => ({}));
    const source = body.source || 'manual';
    console.log(`Iniciando processamento da fila WhatsApp (origem: ${source})`);

    // Inicializar cliente Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Buscar configurações de delay, rotação e estado persistido
    const { data: settings } = await supabase
      .from('whatsapp_settings')
      .select('id, delay_minimo, delay_maximo, envio_pausado, usar_todas_instancias, mensagens_por_instancia, rotacao_instancia_atual, rotacao_contador')
      .single();

    // Verificar se o envio está pausado
    if (settings?.envio_pausado) {
      console.log('⏸️ Envio pausado - processamento cancelado');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Envio pausado',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar se há instâncias ativas ANTES de buscar mensagens (economia de recursos)
    const { data: activeInstancesCheck } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('is_active', true)
      .limit(1);

    if (!activeInstancesCheck || activeInstancesCheck.length === 0) {
      console.log('⚠️ Nenhuma instância WhatsApp ativa - processamento cancelado');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Nenhuma instância ativa configurada',
          processed: 0 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const settingsId = settings?.id;
    const delayMinimo = settings?.delay_minimo || 5;
    const delayMaximo = settings?.delay_maximo || 15;
    const usarTodasInstancias = settings?.usar_todas_instancias || false;
    const mensagensPorInstancia = settings?.mensagens_por_instancia || 5;

    console.log(`Delay configurado: ${delayMinimo}s - ${delayMaximo}s`);
    console.log(`Rotação: ${usarTodasInstancias ? `ativa (${mensagensPorInstancia} msgs/instância)` : 'desativada'}`);

    // 2. Buscar mensagens pendentes com lock atômico (previne race conditions)
    const { data: messages, error: messagesError } = await supabase
      .rpc('get_and_lock_pending_messages', {
        batch_size: 10,
        check_time: new Date().toISOString()
      });

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

    // Ordenar mensagens por telefone para agrupar do mesmo cliente
    // Isso permite enviar mensagens do mesmo cliente em sequência rápida
    const sortedMessages = [...messages].sort((a, b) => {
      // Primeiro por telefone, depois por data de criação
      if (a.phone !== b.phone) {
        return a.phone.localeCompare(b.phone);
      }
      return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
    });

    console.log(`Processando ${sortedMessages.length} mensagens (ordenadas por telefone)`);

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

    console.log(`📱 Instâncias ativas: ${instances.map(i => i.nome).join(', ')}`);

    // 4. Inicializar estado da rotação a partir do banco (persistência entre ciclos)
    let rotationState: RotationState = { 
      currentInstanceId: settings?.rotacao_instancia_atual || instances[0].id, 
      messageCount: settings?.rotacao_contador || 0 
    };
    
    console.log(`📊 Estado rotação inicial: instância=${rotationState.currentInstanceId}, contador=${rotationState.messageCount}`);

    // Função auxiliar para persistir estado de rotação
    const saveRotationState = async (state: RotationState) => {
      if (settingsId && usarTodasInstancias) {
        await supabase
          .from('whatsapp_settings')
          .update({ 
            rotacao_instancia_atual: state.currentInstanceId,
            rotacao_contador: state.messageCount 
          })
          .eq('id', settingsId);
      }
    };

    // Delay mínimo entre mensagens do mesmo cliente (sequência rápida)
    const DELAY_MESMO_CLIENTE = 3; // segundos

    // 5. Processar cada mensagem (usando lista ordenada por telefone)
    for (let i = 0; i < sortedMessages.length; i++) {
      const msg = sortedMessages[i];
      try {
        // Verificação dupla: confirmar que a mensagem ainda está pendente
        const { data: currentMsg } = await supabase
          .from('whatsapp_queue')
          .select('status')
          .eq('id', msg.id)
          .single();

        // Se já foi processada, pular
        if (currentMsg?.status !== 'pending') {
          console.log(`Mensagem ${msg.id} já processada, pulando...`);
          continue;
        }

        // Determinar qual instância usar
        let activeInstance: WhatsappInstance;
        
        if (usarTodasInstancias && instances.length > 1) {
          // Modo rotação: usar próxima instância baseado no estado persistido
          const rotation = getNextInstance(instances, rotationState, mensagensPorInstancia);
          activeInstance = rotation.instance;
          rotationState = rotation.newState;
        } else {
          // Modo padrão: usar primeira instância
          activeInstance = instances[0];
        }

        // Marcar como processando
        await supabase
          .from('whatsapp_queue')
          .update({ 
            status: 'processing',
            instance_id: activeInstance.id
          })
          .eq('id', msg.id);

        console.log(`📤 Processando ${msg.id} para ${msg.phone} via ${activeInstance.nome} (${rotationState.messageCount + 1}/${mensagensPorInstancia})`);

        // Tentar enviar usando instância selecionada
        const { data, error } = await supabase.functions.invoke('send-whatsapp', {
          body: { 
            phone: msg.phone, 
            message: msg.message,
            instance_id: activeInstance.id,
            media_url: msg.media_url || undefined,
            media_type: msg.media_type || undefined,
            caption: msg.caption || undefined,
          }
        });

        if (error || !data?.success) {
          // Falha no envio
          const newAttempts = msg.attempts + 1;
          
          // Se usa rotação e há mais instâncias, forçar rotação para próxima tentativa
          if (usarTodasInstancias && instances.length > 1) {
            const fallback = getNextInstance(instances, rotationState, mensagensPorInstancia, true);
            rotationState = fallback.newState;
            await saveRotationState(rotationState);
            console.log(`⚠️ Erro na ${activeInstance.nome}, próxima tentativa usará ${fallback.instance.nome}`);
          }
          
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
            
            console.log(`❌ Mensagem ${msg.id} falhou após ${newAttempts} tentativas`);
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
            
            console.log(`🔄 Mensagem ${msg.id} reagendada (tentativa ${newAttempts})`);
          }
        } else {
          // Sucesso - incrementar contador de rotação
          rotationState.messageCount++;
          
          await supabase
            .from('whatsapp_queue')
            .update({ 
              status: 'sent',
              sent_at: new Date().toISOString(),
              attempts: msg.attempts + 1,
              instance_id: activeInstance.id
            })
            .eq('id', msg.id);
          
          // Atualizar status do pedido para "enviada" se tiver pedido_id
          if (msg.pedido_id) {
            await supabase
              .from('pedidos')
              .update({ mensagem_enviada: 'enviada' })
              .eq('id', msg.pedido_id);
          }
          
          console.log(`✅ Mensagem ${msg.id} enviada via ${activeInstance.nome}`);
          successCount++;
          
          // Verificar se precisa rotacionar após sucesso
          if (usarTodasInstancias && rotationState.messageCount >= mensagensPorInstancia) {
            const nextRotation = getNextInstance(instances, rotationState, mensagensPorInstancia);
            rotationState = nextRotation.newState;
            console.log(`🔄 Rotacionando para: ${nextRotation.instance.nome}`);
          }
          
          // Persistir estado após cada envio com sucesso
          await saveRotationState(rotationState);
        }

        processedCount++;

        // Aplicar delay antes da próxima mensagem (exceto na última)
        if (i < sortedMessages.length - 1) {
          const nextMsg = sortedMessages[i + 1];
          const isSamePhone = nextMsg?.phone === msg.phone;
          
          if (isSamePhone) {
            // Mesmo cliente: delay mínimo (sequência rápida)
            console.log(`⚡ Próxima mensagem é do mesmo cliente (${msg.phone}), delay rápido: ${DELAY_MESMO_CLIENTE}s`);
            await sleep(DELAY_MESMO_CLIENTE * 1000);
          } else {
            // Cliente diferente: delay normal configurado
            const delaySeconds = getRandomDelay(delayMinimo, delayMaximo);
            console.log(`⏳ Próximo cliente diferente, delay normal: ${delaySeconds}s`);
            await sleep(delaySeconds * 1000);
          }
        }

      } catch (error) {
        console.error(`Erro ao processar mensagem ${msg.id}:`, error);
        
        // Em caso de erro, forçar rotação se habilitado
        if (usarTodasInstancias && instances.length > 1) {
          const fallback = getNextInstance(instances, rotationState, mensagensPorInstancia, true);
          rotationState = fallback.newState;
          await saveRotationState(rotationState);
        }
        
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

    console.log(`📊 Processamento concluído: ${successCount} enviadas, ${failedCount} falharam`);

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