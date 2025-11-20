import { supabase } from "@/integrations/supabase/client";

export const logout = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const isAdmin = async (userId: string) => {
  const { data } = await supabase.rpc('is_admin', { check_user_id: userId });
  return data || false;
};

export const initializeAdmin = async (email: string, password: string, fullName: string) => {
  const { data, error } = await supabase.functions.invoke('initialize-admin', {
    body: { email, password, full_name: fullName }
  });
  
  if (error) throw error;
  return data;
};
