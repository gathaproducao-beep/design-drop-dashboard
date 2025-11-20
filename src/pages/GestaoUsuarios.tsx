import { useState } from "react";
import { Navigation } from "@/components/Navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Shield } from "lucide-react";
import UsuariosTable from "@/components/usuarios/UsuariosTable";
import PerfisTable from "@/components/perfis/PerfisTable";

const GestaoUsuarios = () => {
  const [activeTab, setActiveTab] = useState("usuarios");

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto p-6 max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Gestão de Usuários
          </h1>
          <p className="text-muted-foreground">
            Gerencie usuários e perfis de acesso do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-8">
            <TabsTrigger value="usuarios" className="gap-2">
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="perfis" className="gap-2">
              <Shield className="h-4 w-4" />
              Perfis de Acesso
            </TabsTrigger>
          </TabsList>

          <TabsContent value="usuarios">
            <Card>
              <CardHeader>
                <CardTitle>Usuários do Sistema</CardTitle>
                <CardDescription>
                  Gerencie os usuários e suas permissões de acesso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <UsuariosTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="perfis">
            <Card>
              <CardHeader>
                <CardTitle>Perfis de Acesso</CardTitle>
                <CardDescription>
                  Configure os perfis e suas permissões no sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PerfisTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default GestaoUsuarios;
