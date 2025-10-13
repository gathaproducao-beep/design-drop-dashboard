import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { MockupsList } from "@/components/mockups/MockupsList";
import { NovoMockupDialog } from "@/components/mockups/NovoMockupDialog";
import { MockupEditor } from "@/components/mockups/MockupEditor";
import { Navigation } from "@/components/Navigation";

export default function Mockups() {
  const [mockups, setMockups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [novoMockupOpen, setNovoMockupOpen] = useState(false);
  const [selectedMockup, setSelectedMockup] = useState<any>(null);

  useEffect(() => {
    carregarMockups();
  }, []);

  const carregarMockups = async () => {
    try {
      const { data, error } = await supabase
        .from("mockups")
        .select("*, mockup_areas(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setMockups(data || []);
    } catch (error) {
      console.error("Erro ao carregar mockups:", error);
      toast.error("Erro ao carregar mockups");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        {selectedMockup ? (
          <MockupEditor
            mockup={selectedMockup}
            onClose={() => setSelectedMockup(null)}
            onSave={carregarMockups}
          />
        ) : (
          <>
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h1 className="text-4xl font-bold text-foreground mb-2">
                  Mockups
                </h1>
                <p className="text-muted-foreground">
                  Gerencie templates de mockups e suas áreas editáveis
                </p>
              </div>
              <Button
                onClick={() => setNovoMockupOpen(true)}
                className="bg-gradient-to-r from-primary to-primary/80 hover:shadow-lg transition-all"
              >
                <Plus className="mr-2 h-4 w-4" />
                Novo Mockup
              </Button>
            </div>

            <MockupsList
              mockups={mockups}
              loading={loading}
              onEdit={setSelectedMockup}
              onRefresh={carregarMockups}
            />

            <NovoMockupDialog
              open={novoMockupOpen}
              onOpenChange={setNovoMockupOpen}
              onSuccess={carregarMockups}
            />
          </>
        )}
      </div>
    </div>
  );
}
