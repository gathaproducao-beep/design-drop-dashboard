-- Adicionar campos para persistir estado de rotação entre ciclos de processamento
ALTER TABLE whatsapp_settings 
ADD COLUMN IF NOT EXISTS rotacao_instancia_atual text,
ADD COLUMN IF NOT EXISTS rotacao_contador integer DEFAULT 0;