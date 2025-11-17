-- Adicionar campos type e is_active à tabela mensagens_whatsapp
ALTER TABLE mensagens_whatsapp 
ADD COLUMN type text DEFAULT 'aprovacao' CHECK (type IN ('aprovacao', 'conclusao')),
ADD COLUMN is_active boolean DEFAULT true;

-- Criar tabela de configurações do WhatsApp
CREATE TABLE whatsapp_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  default_instance text NOT NULL DEFAULT 'personalizado',
  test_phone text,
  auto_send_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Inserir configuração padrão
INSERT INTO whatsapp_settings (default_instance, auto_send_enabled) 
VALUES ('personalizado', false);

-- Trigger para updated_at em whatsapp_settings
CREATE TRIGGER handle_updated_at_whatsapp_settings
  BEFORE UPDATE ON whatsapp_settings
  FOR EACH ROW
  EXECUTE FUNCTION handle_updated_at();

-- RLS para whatsapp_settings
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo em whatsapp_settings" 
ON whatsapp_settings 
FOR ALL 
USING (true) 
WITH CHECK (true);