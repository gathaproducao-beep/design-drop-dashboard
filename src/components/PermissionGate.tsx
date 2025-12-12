import { ReactNode } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface PermissionGateProps {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const { permissions, isAdmin, isLoading } = usePermissions();
  
  if (isLoading) return null;
  
  const hasPermission = isAdmin || permissions.includes(permission);
  
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
