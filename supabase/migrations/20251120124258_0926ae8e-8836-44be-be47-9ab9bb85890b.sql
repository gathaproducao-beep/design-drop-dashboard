-- Corrigir search_path da função para segurança
DROP FUNCTION IF EXISTS get_and_lock_pending_messages(INTEGER, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION get_and_lock_pending_messages(
  batch_size INTEGER,
  check_time TIMESTAMPTZ
)
RETURNS SETOF whatsapp_queue
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT *
  FROM public.whatsapp_queue
  WHERE status = 'pending'
    AND scheduled_at <= check_time
  ORDER BY created_at ASC
  LIMIT batch_size
  FOR UPDATE SKIP LOCKED;
$$;