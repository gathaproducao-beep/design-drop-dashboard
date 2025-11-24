-- Adicionar coluna para controlar se pedido deve ser salvo no Drive
ALTER TABLE pedidos 
ADD COLUMN salvar_drive BOOLEAN DEFAULT false;