-- ===============================================
-- Corrigir search_path da função notify_whatsapp_queue_insert
-- ===============================================
CREATE OR REPLACE FUNCTION public.notify_whatsapp_queue_insert()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  anon_key text;
BEGIN
  -- Só dispara se a mensagem é pendente
  IF NEW.status = 'pending' THEN
    edge_function_url := 'https://neqtlreqfkrxzvuxaprl.supabase.co/functions/v1/process-whatsapp-queue';
    anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5lcXRscmVxZmtyeHp2dXhhcHJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAzOTAzMTAsImV4cCI6MjA3NTk2NjMxMH0.igL89upQosVsPxdn-I73f7MOa2ui5Ge264U9OLI_DCA';
    
    -- Chamar edge function via pg_net de forma assíncrona
    PERFORM extensions.net.http_post(
      url := edge_function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
      body := jsonb_build_object('source', 'trigger')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions';