import { Navigation } from "@/components/Navigation";
import { MensagensWhatsappTable } from "@/components/mensagens/MensagensWhatsappTable";

const MensagensWhatsapp = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">Mensagens WhatsApp</h1>
          <p className="text-muted-foreground">
            Configure templates de mensagens com variáveis dinâmicas
          </p>
        </div>
        <MensagensWhatsappTable />
      </div>
    </div>
  );
};

export default MensagensWhatsapp;
