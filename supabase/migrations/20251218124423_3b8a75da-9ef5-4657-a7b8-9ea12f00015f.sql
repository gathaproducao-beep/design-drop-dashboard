-- Adicionar campo para habilitar/desabilitar integração do Google Drive
ALTER TABLE public.google_drive_settings 
ADD COLUMN IF NOT EXISTS integration_enabled boolean NOT NULL DEFAULT false;