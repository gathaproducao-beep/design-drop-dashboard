import { Navigation } from "@/components/Navigation";
import { FilaWhatsappTable } from "@/components/whatsapp/FilaWhatsappTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function FilaWhatsapp() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto py-8 px-4">
        <Card>
          <CardHeader>
            <CardTitle>Fila de Envios WhatsApp</CardTitle>
            <CardDescription>
              Monitore o status de todas as mensagens enviadas através do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FilaWhatsappTable />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
