-- Adicionar campo para pausar envio de mensagens
ALTER TABLE whatsapp_settings 
ADD COLUMN IF NOT EXISTS envio_pausado BOOLEAN NOT NULL DEFAULT false;