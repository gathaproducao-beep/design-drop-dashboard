-- Adicionar campos para suporte a Webhook na tabela whatsapp_instances
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS webhook_url text,
ADD COLUMN IF NOT EXISTS webhook_headers jsonb DEFAULT '{}'::jsonb;