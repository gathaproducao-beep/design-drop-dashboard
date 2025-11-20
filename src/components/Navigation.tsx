import { Link, useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Image, MessageSquare, Settings, Users, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { logout } from "@/lib/auth";
import { toast } from "sonner";
import { useState } from "react";

export function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const links = [
    { to: "/", icon: LayoutDashboard, label: "Pedidos" },
    { to: "/mockups", icon: Image, label: "Mockups" },
    { to: "/mensagens", icon: MessageSquare, label: "Mensagens" },
    { to: "/fila-whatsapp", icon: MessageSquare, label: "Fila de Envios" },
    { to: "/configuracoes-whatsapp", icon: Settings, label: "Configurações" },
    { to: "/gestao-usuarios", icon: Users, label: "Usuários" },
  ];

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
              {links.map((link) => {
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
              })}
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
