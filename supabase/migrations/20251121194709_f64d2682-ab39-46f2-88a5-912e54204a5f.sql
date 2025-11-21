-- Criar tabela de configurações do Google Drive
CREATE TABLE IF NOT EXISTS public.google_drive_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  client_secret text NOT NULL,
  refresh_token text NOT NULL,
  root_folder_id text,
  auto_upload_enabled boolean NOT NULL DEFAULT false,
  folder_structure text NOT NULL DEFAULT 'pedido',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.google_drive_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar configurações do Google Drive
CREATE POLICY "Admins can manage google drive settings"
  ON public.google_drive_settings
  FOR ALL
  USING (is_admin(auth.uid()));

-- Adicionar colunas na tabela pedidos para armazenar referência do Drive
ALTER TABLE public.pedidos 
ADD COLUMN IF NOT EXISTS drive_folder_id text,
ADD COLUMN IF NOT EXISTS drive_folder_url text;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_google_drive_settings_updated_at
  BEFORE UPDATE ON public.google_drive_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();