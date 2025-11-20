-- 1. Criar tabela de profiles (dados públicos do usuário)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  whatsapp text,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 2. Criar tabela de perfis de acesso
CREATE TABLE IF NOT EXISTS public.access_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean DEFAULT false NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- 3. Criar tabela de permissões
CREATE TABLE IF NOT EXISTS public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  category text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- 4. Criar tabela de relacionamento perfil <-> permissões
CREATE TABLE IF NOT EXISTS public.profile_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(access_profile_id, permission_id)
);

-- 5. Criar tabela de relacionamento usuário <-> perfis
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_profile_id uuid NOT NULL REFERENCES public.access_profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, access_profile_id)
);

-- 6. Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 7. Criar função security definer para verificar se é admin
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN access_profiles ap ON ap.id = ur.access_profile_id
    WHERE ur.user_id = check_user_id
    AND ap.code = 'admin'
  );
$$;

-- 8. Criar função security definer para verificar permissão específica
CREATE OR REPLACE FUNCTION public.user_has_permission(
  check_user_id uuid, 
  permission_code text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN profile_permissions pp ON pp.access_profile_id = ur.access_profile_id
    JOIN permissions p ON p.id = pp.permission_id
    WHERE ur.user_id = check_user_id
    AND p.code = permission_code
  );
$$;

-- 9. Criar trigger para criar profile automaticamente quando usuário é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 10. Criar trigger para atualizar updated_at em profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 11. Criar trigger para atualizar updated_at em access_profiles
CREATE TRIGGER update_access_profiles_updated_at
  BEFORE UPDATE ON public.access_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 12. Policies RLS para profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins can insert profiles"
  ON public.profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 13. Policies RLS para access_profiles
CREATE POLICY "Authenticated users can view access profiles"
  ON public.access_profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert access profiles"
  ON public.access_profiles FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update access profiles"
  ON public.access_profiles FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete access profiles"
  ON public.access_profiles FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 14. Policies RLS para permissions
CREATE POLICY "Authenticated users can view permissions"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert permissions"
  ON public.permissions FOR INSERT
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update permissions"
  ON public.permissions FOR UPDATE
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete permissions"
  ON public.permissions FOR DELETE
  USING (public.is_admin(auth.uid()));

-- 15. Policies RLS para profile_permissions
CREATE POLICY "Authenticated users can view profile permissions"
  ON public.profile_permissions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage profile permissions"
  ON public.profile_permissions FOR ALL
  USING (public.is_admin(auth.uid()));

-- 16. Policies RLS para user_roles
CREATE POLICY "Admins can view all user roles"
  ON public.user_roles FOR SELECT
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage user roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin(auth.uid()));

-- 17. SEED DATA - Criar perfil Administrador
INSERT INTO public.access_profiles (code, name, description, is_system)
VALUES ('admin', 'Administrador', 'Acesso total ao sistema', true)
ON CONFLICT (code) DO NOTHING;

-- 18. SEED DATA - Criar permissões
INSERT INTO public.permissions (code, name, description, category) VALUES
  -- Usuários
  ('criar_usuario', 'Criar Usuário', 'Permite criar novos usuários', 'Usuários'),
  ('editar_usuario', 'Editar Usuário', 'Permite editar dados de usuários', 'Usuários'),
  ('deletar_usuario', 'Deletar Usuário', 'Permite remover usuários do sistema', 'Usuários'),
  ('visualizar_usuarios', 'Visualizar Usuários', 'Permite ver lista de usuários', 'Usuários'),
  
  -- Perfis de Acesso
  ('criar_perfil', 'Criar Perfil', 'Permite criar novos perfis de acesso', 'Perfis'),
  ('editar_perfil', 'Editar Perfil', 'Permite editar perfis de acesso', 'Perfis'),
  ('deletar_perfil', 'Deletar Perfil', 'Permite remover perfis de acesso', 'Perfis'),
  ('visualizar_perfis', 'Visualizar Perfis', 'Permite ver lista de perfis', 'Perfis'),
  
  -- Relatórios
  ('visualizar_relatorios', 'Visualizar Relatórios', 'Permite acessar relatórios', 'Relatórios'),
  ('exportar_relatorios', 'Exportar Relatórios', 'Permite exportar dados de relatórios', 'Relatórios'),
  
  -- Configurações
  ('editar_configuracoes', 'Editar Configurações', 'Permite alterar configurações do sistema', 'Configurações')
ON CONFLICT (code) DO NOTHING;

-- 19. SEED DATA - Associar todas permissões ao perfil admin
INSERT INTO public.profile_permissions (access_profile_id, permission_id)
SELECT 
  (SELECT id FROM public.access_profiles WHERE code = 'admin'),
  id
FROM public.permissions
ON CONFLICT (access_profile_id, permission_id) DO NOTHING;