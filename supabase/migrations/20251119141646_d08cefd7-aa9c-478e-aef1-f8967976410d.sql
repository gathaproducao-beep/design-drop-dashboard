-- Adicionar campos para suporte a mídia na fila do WhatsApp
ALTER TABLE whatsapp_queue 
ADD COLUMN IF NOT EXISTS media_url TEXT,
ADD COLUMN IF NOT EXISTS media_type TEXT CHECK (media_type IN ('image', 'video', 'document', 'audio')),
ADD COLUMN IF NOT EXISTS caption TEXT;

-- Adicionar índice para melhorar performance de queries com media_type
CREATE INDEX IF NOT EXISTS idx_whatsapp_queue_media_type ON whatsapp_queue(media_type) WHERE media_type IS NOT NULL;