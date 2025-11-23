import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Lock, UserPlus } from "lucide-react";
import { initializeAdmin } from "@/lib/auth";

const Auth = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initializingAdmin, setInitializingAdmin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showInitAdmin, setShowInitAdmin] = useState(false);

  useEffect(() => {
    // Verificar se já está autenticado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/");
      }
    });

    // Verificar se há admins no sistema
    checkForAdmins();
  }, [navigate]);

  const checkForAdmins = async () => {
    try {
      const { data } = await supabase
        .from('user_roles')
        .select('id')
        .limit(1);
      
      setShowInitAdmin(!data || data.length === 0);
    } catch (error) {
      console.error('Erro ao verificar admins:', error);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast.success("Login realizado com sucesso!");
      navigate("/");
    } catch (error: any) {
      console.error("Erro no login:", error);
      toast.error(error.message || "Erro ao fazer login");
    } finally {
      setLoading(false);
    }
  };

  const handleInitializeAdmin = async () => {
    if (!email || !password) {
      toast.error("Preencha email e senha para criar o administrador");
      return;
    }

    setInitializingAdmin(true);

    try {
      await initializeAdmin(email, password, "Administrador");
      toast.success("Administrador criado com sucesso! Faça login agora.");
      setShowInitAdmin(false);
      await checkForAdmins(); // Recarrega para confirmar
    } catch (error: any) {
      console.error("Erro ao criar admin:", error);
      toast.error(error.message || "Erro ao criar administrador");
    } finally {
      setInitializingAdmin(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Login</CardTitle>
          <CardDescription>
            Entre com suas credenciais para acessar o sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                autoComplete="current-password"
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>

            {showInitAdmin && (
              <Button
                type="button"
                variant="outline"
                className="w-full mt-2"
                onClick={handleInitializeAdmin}
                disabled={initializingAdmin}
              >
                {initializingAdmin && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {!initializingAdmin && <UserPlus className="mr-2 h-4 w-4" />}
                Criar Primeiro Administrador
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
