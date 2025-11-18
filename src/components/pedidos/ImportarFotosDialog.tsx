import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Upload, CheckCircle, AlertCircle, XCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ImportarFotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  gerarFotoAuto: boolean;
}

interface FotoProcessada {
  arquivo: File;
  nomeOriginal: string;
  numeroPedido: string | null;
  pedidoEncontrado?: any;
  status: 'pendente' | 'processando' | 'sucesso' | 'nao_encontrado' | 'erro';
  urlUpload?: string;
  mensagemErro?: string;
  preview?: string;
}

export function ImportarFotosDialog({ 
  open, 
  onOpenChange, 
  onSuccess,
  gerarFotoAuto 
}: ImportarFotosDialogProps) {
  const [fotos, setFotos] = useState<FotoProcessada[]>([]);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState(0);
  const [etapa, setEtapa] = useState<'selecao' | 'analise' | 'importacao' | 'concluido'>('selecao');

  const extrairNumeroPedido = (nomeArquivo: string): string | null => {
    // Remove extensão
    const semExtensao = nomeArquivo.replace(/\.(jpg|jpeg|png|gif|webp)$/i, '');
    // Retorna o nome completo (pode ter hífen ou não)
    return semExtensao || null;
  };

  const handleSelecionarFotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arquivos = Array.from(e.target.files || []);
    
    if (arquivos.length === 0) return;

    // Validar arquivos
    const fotosValidas: FotoProcessada[] = [];
    
    for (const arquivo of arquivos) {
      // Validar tipo
      if (!arquivo.type.startsWith('image/')) {
        toast.error(`${arquivo.name} não é uma imagem válida`);
        continue;
      }
      
      // Validar tamanho (10MB)
      if (arquivo.size > 10 * 1024 * 1024) {
        toast.error(`${arquivo.name} excede 10MB`);
        continue;
      }

      // Criar preview
      const preview = URL.createObjectURL(arquivo);
      
      const numeroPedido = extrairNumeroPedido(arquivo.name);
      
      fotosValidas.push({
        arquivo,
        nomeOriginal: arquivo.name,
        numeroPedido,
        status: 'pendente',
        preview
      });
    }

    setFotos(fotosValidas);
    setEtapa('analise');
    
    // Buscar pedidos correspondentes
    await analisarPedidos(fotosValidas);
  };

  const analisarPedidos = async (fotosParaAnalisar: FotoProcessada[]) => {
    const fotosAtualizadas = [...fotosParaAnalisar];
    
    for (let i = 0; i < fotosAtualizadas.length; i++) {
      const foto = fotosAtualizadas[i];
      
      if (!foto.numeroPedido) {
        foto.status = 'nao_encontrado';
        foto.mensagemErro = 'Não foi possível extrair número do pedido';
        continue;
      }

      try {
        const { data, error } = await supabase
          .from('pedidos')
          .select('*')
          .eq('numero_pedido', foto.numeroPedido)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          foto.pedidoEncontrado = data;
          foto.status = 'pendente'; // Pronto para importar
        } else {
          foto.status = 'nao_encontrado';
          foto.mensagemErro = 'Pedido não encontrado';
        }
      } catch (error) {
        console.error('Erro ao buscar pedido:', error);
        foto.status = 'erro';
        foto.mensagemErro = 'Erro ao buscar pedido';
      }
      
      setFotos([...fotosAtualizadas]);
    }
  };

  const handleImportar = async () => {
    const fotosParaImportar = fotos.filter(f => f.status === 'pendente' && f.pedidoEncontrado);
    
    if (fotosParaImportar.length === 0) {
      toast.error('Nenhuma foto pronta para importar');
      return;
    }

    setProcessando(true);
    setEtapa('importacao');
    setProgresso(0);

    let sucessos = 0;
    let erros = 0;
    const pedidosAtualizados: string[] = [];

    for (let i = 0; i < fotosParaImportar.length; i++) {
      const foto = fotosParaImportar[i];
      foto.status = 'processando';
      setFotos([...fotos]);

      try {
        const pedido = foto.pedidoEncontrado;
        const extensao = foto.arquivo.name.split('.').pop();
        const timestamp = Date.now();
        const caminhoStorage = `clientes/${pedido.id}-cliente-${timestamp}.${extensao}`;

        // Upload para storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('mockup-images')
          .upload(caminhoStorage, foto.arquivo, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) throw uploadError;

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('mockup-images')
          .getPublicUrl(caminhoStorage);

        foto.urlUpload = publicUrl;

        // Atualizar pedido (adicionar ao array existente)
        const fotosAtuais = pedido.fotos_cliente || [];
        const novasFotos = [...fotosAtuais, publicUrl];

        const { error: updateError } = await supabase
          .from('pedidos')
          .update({ fotos_cliente: novasFotos })
          .eq('id', pedido.id);

        if (updateError) throw updateError;

        foto.status = 'sucesso';
        sucessos++;
        
        // Adicionar à fila de geração de mockups
        if (gerarFotoAuto && !pedidosAtualizados.includes(pedido.id)) {
          pedidosAtualizados.push(pedido.id);
        }

      } catch (error: any) {
        console.error('Erro ao importar foto:', error);
        foto.status = 'erro';
        foto.mensagemErro = error.message || 'Erro ao fazer upload';
        erros++;
      }

      setFotos([...fotos]);
      setProgresso(((i + 1) / fotosParaImportar.length) * 100);
    }

    setProcessando(false);
    setEtapa('concluido');

    // Mostrar resumo
    if (sucessos > 0) {
      toast.success(`${sucessos} foto(s) importada(s) com sucesso`);
      onSuccess();
    }
    
    if (erros > 0) {
      toast.error(`${erros} foto(s) com erro`);
    }

    const naoVinculadas = fotos.filter(f => f.status === 'nao_encontrado').length;
    if (naoVinculadas > 0) {
      toast.warning(`${naoVinculadas} foto(s) não vinculada(s) (descartadas)`);
    }
    
    // Processar mockups em fila (sequencial para não sobrecarregar)
    if (pedidosAtualizados.length > 0 && gerarFotoAuto) {
      toast.loading(`Gerando ${pedidosAtualizados.length} mockup(s) em fila...`, { id: 'mockups-queue' });
      
      let mockupsGerados = 0;
      for (const pedidoId of pedidosAtualizados) {
        try {
          await gerarMockupParaPedido(pedidoId);
          mockupsGerados++;
          toast.loading(`Gerando mockups... ${mockupsGerados}/${pedidosAtualizados.length}`, { id: 'mockups-queue' });
        } catch (error) {
          console.error(`Erro ao gerar mockup para pedido ${pedidoId}:`, error);
        }
      }
      
      toast.success(`${mockupsGerados} mockup(s) gerado(s)!`, { id: 'mockups-queue' });
    }
  };
  
  const gerarMockupParaPedido = async (pedidoId: string) => {
    try {
      // Buscar dados atualizados do pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', pedidoId)
        .single();

      if (pedidoError || !pedido) {
        console.error('Erro ao buscar pedido:', pedidoError);
        return;
      }

      // Verificar se há foto do cliente
      const fotoCliente = pedido.fotos_cliente?.[0];
      if (!fotoCliente) {
        console.warn(`Pedido ${pedido.numero_pedido} não tem foto de cliente`);
        return;
      }

      // Buscar mockup correspondente ao código do produto
      const { data: mockups, error: mockupError } = await supabase
        .from('mockups')
        .select('*, mockup_canvases!inner(*), mockup_areas(*)')
        .eq('codigo_mockup', pedido.codigo_produto)
        .eq('tipo', 'aprovacao');

      if (mockupError) {
        console.error('Erro ao buscar mockup:', mockupError);
      }

      if (!mockups || mockups.length === 0) {
        console.warn(`Nenhum mockup de aprovação configurado para ${pedido.codigo_produto} - usando foto do cliente`);
      }

      // Atualizar o campo foto_aprovacao com a foto do cliente
      // TODO: Implementar geração real de mockup com composição de imagens quando mockup estiver configurado
      const { error: updateError } = await supabase
        .from('pedidos')
        .update({ 
          foto_aprovacao: [fotoCliente],
          layout_aprovado: 'pendente'
        })
        .eq('id', pedidoId);

      if (updateError) {
        console.error('Erro ao atualizar foto de aprovação:', updateError);
        throw updateError;
      }
        
    } catch (error) {
      console.error('Erro ao gerar mockup:', error);
      throw error;
    }
  };

  const handleFechar = () => {
    setFotos([]);
    setEtapa('selecao');
    setProgresso(0);
    setProcessando(false);
    onOpenChange(false);
  };

  const fotosVinculadas = fotos.filter(f => f.status === 'pendente' && f.pedidoEncontrado).length;
  const fotosNaoVinculadas = fotos.filter(f => f.status === 'nao_encontrado').length;
  const fotosSucesso = fotos.filter(f => f.status === 'sucesso').length;
  const fotosErro = fotos.filter(f => f.status === 'erro').length;

  return (
    <Dialog open={open} onOpenChange={handleFechar}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Importar Fotos de Cliente</DialogTitle>
        </DialogHeader>

        {etapa === 'selecao' && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-4">
                Selecione múltiplas fotos de clientes
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Nome do arquivo deve conter o número do pedido (ex: 9-10346212.jpg)
              </p>
              <Input
                type="file"
                multiple
                accept="image/*"
                onChange={handleSelecionarFotos}
                className="cursor-pointer"
              />
            </div>
          </div>
        )}

        {(etapa === 'analise' || etapa === 'importacao' || etapa === 'concluido') && (
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>{fotosVinculadas} prontas</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span>{fotosNaoVinculadas} não vinculadas</span>
              </div>
              {etapa === 'concluido' && (
                <>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    <span>{fotosSucesso} importadas</span>
                  </div>
                  {fotosErro > 0 && (
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>{fotosErro} com erro</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {etapa === 'importacao' && (
              <div className="space-y-2">
                <Progress value={progresso} />
                <p className="text-sm text-muted-foreground text-center">
                  Processando {Math.round(progresso)}%...
                </p>
              </div>
            )}

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-2">
                {fotos.map((foto, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 border rounded-lg"
                  >
                    <img 
                      src={foto.preview} 
                      alt={foto.nomeOriginal}
                      className="h-12 w-12 object-cover rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {foto.nomeOriginal}
                      </p>
                      {foto.pedidoEncontrado && (
                        <p className="text-xs text-muted-foreground">
                          → Pedido {foto.numeroPedido}
                        </p>
                      )}
                      {foto.mensagemErro && (
                        <p className="text-xs text-red-500">
                          {foto.mensagemErro}
                        </p>
                      )}
                    </div>
                    <div>
                      {foto.status === 'pendente' && foto.pedidoEncontrado && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Pronta
                        </Badge>
                      )}
                      {foto.status === 'nao_encontrado' && (
                        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Não vinculada
                        </Badge>
                      )}
                      {foto.status === 'processando' && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Processando...
                        </Badge>
                      )}
                      {foto.status === 'sucesso' && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Importada
                        </Badge>
                      )}
                      {foto.status === 'erro' && (
                        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                          <XCircle className="h-3 w-3 mr-1" />
                          Erro
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={handleFechar}
                disabled={processando}
              >
                {etapa === 'concluido' ? 'Fechar' : 'Cancelar'}
              </Button>
              {etapa !== 'concluido' && (
                <Button
                  onClick={handleImportar}
                  disabled={processando || fotosVinculadas === 0}
                >
                  {processando ? 'Importando...' : `Importar ${fotosVinculadas} Foto(s)`}
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
