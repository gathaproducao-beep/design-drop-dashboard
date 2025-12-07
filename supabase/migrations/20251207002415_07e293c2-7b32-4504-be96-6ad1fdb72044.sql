-- Adicionar campos para rotação entre instâncias
ALTER TABLE whatsapp_settings
ADD COLUMN IF NOT EXISTS usar_todas_instancias boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS mensagens_por_instancia integer DEFAULT 5;