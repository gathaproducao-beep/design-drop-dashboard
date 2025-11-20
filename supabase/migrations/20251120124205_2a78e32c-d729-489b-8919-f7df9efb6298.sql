-- Criar função RPC que retorna mensagens pendentes com lock atômico
-- Isso previne race conditions garantindo que cada mensagem seja processada por apenas uma execução
CREATE OR REPLACE FUNCTION get_and_lock_pending_messages(
  batch_size INTEGER,
  check_time TIMESTAMPTZ
)
RETURNS SETOF whatsapp_queue
LANGUAGE sql
AS $$
  SELECT *
  FROM whatsapp_queue
  WHERE status = 'pending'
    AND scheduled_at <= check_time
  ORDER BY created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
$$;

-- Criar índice composto para otimizar a query de mensagens pendentes
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_pending_scheduled 
ON whatsapp_queue (status, scheduled_at, created_at) 
WHERE status = 'pending';