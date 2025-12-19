-- Adicionar campos de limpeza automática de storage na tabela google_drive_settings
ALTER TABLE public.google_drive_settings
ADD COLUMN IF NOT EXISTS storage_cleanup_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS storage_cleanup_days integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS cleanup_foto_aprovacao boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS cleanup_molde_producao boolean DEFAULT true;