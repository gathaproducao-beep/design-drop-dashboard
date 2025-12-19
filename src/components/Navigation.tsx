import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Image, MessageSquare, Settings, Users, LogOut, Layers, Cloud, Loader2, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";

interface NavLink {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  permission?: string;
}

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { permissions, isAdmin, isLoading } = usePermissions();

  const allLinks: NavLink[] = [
    { to: "/", icon: LayoutDashboard, label: "Pedidos", permission: "visualizar_pedidos" },
    { to: "/mockups", icon: Image, label: "Mockups", permission: "visualizar_mockups" },
    { to: "/templates", icon: Layers, label: "Templates", permission: "visualizar_mockups" },
    { to: "/mensagens", icon: MessageSquare, label: "Mensagens", permission: "visualizar_mensagens" },
    { to: "/fila-whatsapp", icon: MessageSquare, label: "Fila de Envios", permission: "visualizar_fila" },
    { to: "/configuracoes-whatsapp", icon: Settings, label: "Config. WhatsApp", permission: "visualizar_configuracoes" },
    { to: "/configuracoes-drive", icon: Cloud, label: "Google Drive", permission: "editar_configuracoes" },
    { to: "/configuracoes", icon: Wrench, label: "Configurações", permission: "editar_configuracoes" },
    { to: "/gestao-usuarios", icon: Users, label: "Usuários", permission: "visualizar_usuarios" },
  ];

  const hasPermission = (permissionCode?: string): boolean => {
    if (!permissionCode) return true;
    if (isAdmin) return true;
    return permissions.includes(permissionCode);
  };

  const visibleLinks = allLinks.filter(link => hasPermission(link.permission));

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      toast.success("Logout realizado com sucesso");
      navigate("/auth");
    } catch (error: any) {
      toast.error("Erro ao fazer logout");
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="border-b bg-card shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              <span className="font-bold text-xl">Mockup Manager</span>
            </Link>
            <div className="flex gap-1">
              {isLoading ? (
                <div className="flex items-center gap-2 px-4 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : (
                visibleLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = location.pathname === link.to;
                  return (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-lg transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })
              )}
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Sair
          </Button>
        </div>
      </div>
    </nav>
  );
}
