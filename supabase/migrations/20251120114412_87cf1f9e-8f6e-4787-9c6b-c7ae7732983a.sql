-- Limpar permissões antigas que não fazem sentido
DELETE FROM profile_permissions WHERE permission_id IN (
  SELECT id FROM permissions WHERE code IN ('view_reports', 'create_reports')
);
DELETE FROM permissions WHERE code IN ('view_reports', 'create_reports');

-- Inserir novas permissões categorizadas por funcionalidade

-- Categoria: Pedidos
INSERT INTO permissions (code, name, description, category) VALUES
('criar_pedido', 'Criar Pedido', 'Permite criar novos pedidos', 'Pedidos'),
('visualizar_pedidos', 'Visualizar Pedidos', 'Permite visualizar a lista de pedidos', 'Pedidos'),
('editar_pedido', 'Editar Pedido', 'Permite editar informações dos pedidos', 'Pedidos'),
('deletar_pedido', 'Deletar Pedido', 'Permite excluir pedidos', 'Pedidos'),
('importar_pedidos', 'Importar Pedidos', 'Permite importar pedidos via Excel', 'Pedidos'),
('importar_fotos', 'Importar Fotos', 'Permite importar fotos em lote', 'Pedidos')
ON CONFLICT (code) DO NOTHING;

-- Categoria: Mockups
INSERT INTO permissions (code, name, description, category) VALUES
('criar_mockup', 'Criar Mockup', 'Permite criar novos mockups', 'Mockups'),
('visualizar_mockups', 'Visualizar Mockups', 'Permite visualizar a lista de mockups', 'Mockups'),
('editar_mockup', 'Editar Mockup', 'Permite editar mockups existentes', 'Mockups'),
('deletar_mockup', 'Deletar Mockup', 'Permite excluir mockups', 'Mockups')
ON CONFLICT (code) DO NOTHING;

-- Categoria: Mensagens WhatsApp
INSERT INTO permissions (code, name, description, category) VALUES
('criar_mensagem', 'Criar Mensagem', 'Permite criar templates de mensagem', 'Mensagens WhatsApp'),
('visualizar_mensagens', 'Visualizar Mensagens', 'Permite visualizar templates de mensagem', 'Mensagens WhatsApp'),
('editar_mensagem', 'Editar Mensagem', 'Permite editar templates de mensagem', 'Mensagens WhatsApp'),
('deletar_mensagem', 'Deletar Mensagem', 'Permite excluir templates de mensagem', 'Mensagens WhatsApp')
ON CONFLICT (code) DO NOTHING;

-- Categoria: Fila de Envios
INSERT INTO permissions (code, name, description, category) VALUES
('visualizar_fila', 'Visualizar Fila', 'Permite visualizar a fila de envios', 'Fila de Envios'),
('enviar_mensagem', 'Enviar Mensagem', 'Permite enviar mensagens via WhatsApp', 'Fila de Envios'),
('cancelar_envio', 'Cancelar Envio', 'Permite cancelar mensagens agendadas', 'Fila de Envios'),
('reenviar_mensagem', 'Reenviar Mensagem', 'Permite reenviar mensagens com falha', 'Fila de Envios')
ON CONFLICT (code) DO NOTHING;

-- Categoria: Configurações WhatsApp
INSERT INTO permissions (code, name, description, category) VALUES
('visualizar_configuracoes', 'Visualizar Configurações', 'Permite visualizar configurações do WhatsApp', 'Configurações WhatsApp'),
('editar_configuracoes', 'Editar Configurações', 'Permite alterar configurações do WhatsApp', 'Configurações WhatsApp'),
('gerenciar_instancias', 'Gerenciar Instâncias', 'Permite criar e gerenciar instâncias do WhatsApp', 'Configurações WhatsApp')
ON CONFLICT (code) DO NOTHING;

-- Associar TODAS as permissões ao perfil admin
INSERT INTO profile_permissions (access_profile_id, permission_id)
SELECT 
  (SELECT id FROM access_profiles WHERE code = 'admin'),
  id
FROM permissions
WHERE code NOT IN (
  SELECT p.code 
  FROM permissions p
  JOIN profile_permissions pp ON pp.permission_id = p.id
  WHERE pp.access_profile_id = (SELECT id FROM access_profiles WHERE code = 'admin')
);

-- Criar perfis de acesso padrão
INSERT INTO access_profiles (code, name, description, is_system) VALUES
('operador', 'Operador', 'Acesso básico para operação diária - visualização e edição de pedidos', true),
('designer', 'Designer', 'Acesso completo a pedidos e mockups para criação de artes', true),
('gerente', 'Gerente', 'Acesso amplo ao sistema, exceto exclusão de usuários e perfis', true)
ON CONFLICT (code) DO NOTHING;

-- Associar permissões ao perfil OPERADOR
INSERT INTO profile_permissions (access_profile_id, permission_id)
SELECT 
  (SELECT id FROM access_profiles WHERE code = 'operador'),
  id
FROM permissions
WHERE code IN (
  'visualizar_pedidos',
  'editar_pedido',
  'visualizar_mockups',
  'visualizar_mensagens',
  'visualizar_fila',
  'enviar_mensagem'
)
ON CONFLICT DO NOTHING;

-- Associar permissões ao perfil DESIGNER
INSERT INTO profile_permissions (access_profile_id, permission_id)
SELECT 
  (SELECT id FROM access_profiles WHERE code = 'designer'),
  id
FROM permissions
WHERE code IN (
  -- Todas de Pedidos
  'criar_pedido',
  'visualizar_pedidos',
  'editar_pedido',
  'deletar_pedido',
  'importar_pedidos',
  'importar_fotos',
  -- Todas de Mockups
  'criar_mockup',
  'visualizar_mockups',
  'editar_mockup',
  'deletar_mockup',
  -- Visualização básica
  'visualizar_mensagens',
  'visualizar_fila'
)
ON CONFLICT DO NOTHING;

-- Associar permissões ao perfil GERENTE
INSERT INTO profile_permissions (access_profile_id, permission_id)
SELECT 
  (SELECT id FROM access_profiles WHERE code = 'gerente'),
  id
FROM permissions
WHERE code IN (
  -- Todas de Pedidos
  'criar_pedido',
  'visualizar_pedidos',
  'editar_pedido',
  'deletar_pedido',
  'importar_pedidos',
  'importar_fotos',
  -- Todas de Mockups
  'criar_mockup',
  'visualizar_mockups',
  'editar_mockup',
  'deletar_mockup',
  -- Todas de Mensagens WhatsApp
  'criar_mensagem',
  'visualizar_mensagens',
  'editar_mensagem',
  'deletar_mensagem',
  -- Todas de Fila de Envios
  'visualizar_fila',
  'enviar_mensagem',
  'cancelar_envio',
  'reenviar_mensagem',
  -- Todas de Configurações WhatsApp
  'visualizar_configuracoes',
  'editar_configuracoes',
  'gerenciar_instancias',
  -- Usuários (sem deletar)
  'criar_usuario',
  'visualizar_usuarios',
  'editar_usuario',
  -- Perfis (apenas visualizar)
  'visualizar_perfis'
)
ON CONFLICT DO NOTHING;