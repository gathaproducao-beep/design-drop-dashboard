-- Adicionar campos para API Oficial do WhatsApp na tabela de instâncias
ALTER TABLE public.whatsapp_instances 
ADD COLUMN IF NOT EXISTS api_type text NOT NULL DEFAULT 'evolution' CHECK (api_type IN ('evolution', 'oficial')),
ADD COLUMN IF NOT EXISTS phone_number_id text,
ADD COLUMN IF NOT EXISTS waba_id text,
ADD COLUMN IF NOT EXISTS access_token text;

-- Comentários para documentação
COMMENT ON COLUMN public.whatsapp_instances.api_type IS 'Tipo de API: evolution para Evolution API, oficial para API Oficial Meta';
COMMENT ON COLUMN public.whatsapp_instances.phone_number_id IS 'ID do número de telefone no Meta Business (apenas para API Oficial)';
COMMENT ON COLUMN public.whatsapp_instances.waba_id IS 'ID da conta WhatsApp Business API no Meta (apenas para API Oficial)';
COMMENT ON COLUMN public.whatsapp_instances.access_token IS 'Token de acesso permanente do System User (apenas para API Oficial)';