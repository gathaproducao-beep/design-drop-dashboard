-- Remover constraint antigo e criar novo que inclui 'webhook'
ALTER TABLE public.whatsapp_instances DROP CONSTRAINT IF EXISTS whatsapp_instances_api_type_check;
ALTER TABLE public.whatsapp_instances ADD CONSTRAINT whatsapp_instances_api_type_check CHECK (api_type IN ('evolution', 'oficial', 'webhook'));