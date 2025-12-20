-- Adicionar campos de agendamento do CRON nas configurações do WhatsApp
ALTER TABLE public.whatsapp_settings 
ADD COLUMN IF NOT EXISTS cron_dias_semana integer[] DEFAULT ARRAY[1,2,3,4,5],
ADD COLUMN IF NOT EXISTS cron_hora_inicio time DEFAULT '08:00',
ADD COLUMN IF NOT EXISTS cron_hora_fim time DEFAULT '18:00',
ADD COLUMN IF NOT EXISTS cron_ativo boolean DEFAULT true;

-- Comentários para documentar os campos
COMMENT ON COLUMN public.whatsapp_settings.cron_dias_semana IS 'Dias da semana permitidos (0=Domingo, 1=Segunda, ..., 6=Sábado)';
COMMENT ON COLUMN public.whatsapp_settings.cron_hora_inicio IS 'Horário de início do período de envio';
COMMENT ON COLUMN public.whatsapp_settings.cron_hora_fim IS 'Horário de fim do período de envio';
COMMENT ON COLUMN public.whatsapp_settings.cron_ativo IS 'Se o agendamento está ativo';