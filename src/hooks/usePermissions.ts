import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface UserPermissions {
  permissions: string[];
  isAdmin: boolean;
  isLoading: boolean;
}

export function usePermissions(): UserPermissions {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchPermissions = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !mounted) {
          setIsLoading(false);
          return;
        }

        // Check if user is admin
        const { data: adminData } = await supabase.rpc('is_admin', { check_user_id: user.id });
        if (mounted) {
          setIsAdmin(adminData || false);
        }

        // Get user's permissions through their roles
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select(`
            access_profile_id,
            access_profiles (
              id,
              profile_permissions (
                permissions (
                  code
                )
              )
            )
          `)
          .eq('user_id', user.id);

        if (mounted && userRoles) {
          const allPermissions = new Set<string>();
          userRoles.forEach((role: any) => {
            role.access_profiles?.profile_permissions?.forEach((pp: any) => {
              if (pp.permissions?.code) {
                allPermissions.add(pp.permissions.code);
              }
            });
          });
          setPermissions(Array.from(allPermissions));
        }
      } catch (error) {
        console.error('Error fetching permissions:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    fetchPermissions();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      fetchPermissions();
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return { permissions, isAdmin, isLoading };
}

export function useHasPermission(permissionCode: string): boolean {
  const { permissions, isAdmin } = usePermissions();
  
  // Admins have all permissions
  if (isAdmin) return true;
  
  return permissions.includes(permissionCode);
}
