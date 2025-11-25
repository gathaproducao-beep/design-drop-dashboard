-- ===============================================
-- Remover trigger problemático que impede inserção na fila
-- ===============================================

-- Remover o trigger
DROP TRIGGER IF EXISTS on_whatsapp_queue_insert ON public.whatsapp_queue;

-- Remover a função do trigger
DROP FUNCTION IF EXISTS public.notify_whatsapp_queue_insert();

-- Comentário explicativo:
-- O CRON job configurado (executa a cada 15min, 7h-21h) será responsável
-- por processar a fila de WhatsApp. Isso garante:
-- 1. Mensagens entram na fila sem erros
-- 2. Processamento confiável e previsível
-- 3. Menor consumo de recursos
-- 4. Sistema mais estável