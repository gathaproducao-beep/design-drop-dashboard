-- Adicionar coluna cancelled_at para rastrear quando mensagens foram canceladas
ALTER TABLE whatsapp_queue 
ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Atualizar constraint de status para incluir 'cancelled'
ALTER TABLE whatsapp_queue 
DROP CONSTRAINT IF EXISTS whatsapp_queue_status_check;

ALTER TABLE whatsapp_queue 
ADD CONSTRAINT whatsapp_queue_status_check 
CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'cancelled'));