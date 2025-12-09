import { useState, useCallback, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { generateMockupsForPedido } from '@/lib/mockup-generator';

interface QueueItem {
  id: string;
  pedido: any;
  tipoGerar: 'all' | 'aprovacao' | 'molde';
  status: 'pending' | 'processing' | 'completed' | 'error';
  error?: string;
}

export function useMockupQueue(onRefresh?: () => void) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const processingRef = useRef(false);

  const addToQueue = useCallback((pedido: any, tipoGerar: 'all' | 'aprovacao' | 'molde' = 'all') => {
    // Verificar se já está na fila
    setQueue(prev => {
      const exists = prev.some(item => item.pedido.id === pedido.id && item.status === 'pending');
      if (exists) {
        console.log(`[Queue] Pedido ${pedido.numero_pedido} já está na fila`);
        return prev;
      }
      
      console.log(`[Queue] Adicionando pedido ${pedido.numero_pedido} à fila`);
      toast.info(`Pedido ${pedido.numero_pedido} adicionado à fila de geração`);
      
      return [...prev, {
        id: `${pedido.id}-${Date.now()}`,
        pedido,
        tipoGerar,
        status: 'pending'
      }];
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    
    setQueue(currentQueue => {
      const pendingItem = currentQueue.find(item => item.status === 'pending');
      if (!pendingItem) return currentQueue;
      
      // Marcar como processando
      processingRef.current = true;
      setIsProcessing(true);
      
      // Processar de forma assíncrona
      (async () => {
        try {
          console.log(`[Queue] Processando pedido ${pendingItem.pedido.numero_pedido}...`);
          
          await generateMockupsForPedido(pendingItem.pedido, pendingItem.tipoGerar, (msg) => {
            console.log(`[Mockup ${pendingItem.pedido.numero_pedido}] ${msg}`);
          });
          
          setQueue(prev => prev.map(item => 
            item.id === pendingItem.id 
              ? { ...item, status: 'completed' as const }
              : item
          ));
          
          toast.success(`Mockup do pedido ${pendingItem.pedido.numero_pedido} gerado!`);
          onRefresh?.();
          
        } catch (error: any) {
          console.error(`[Queue] Erro ao processar ${pendingItem.pedido.numero_pedido}:`, error);
          
          setQueue(prev => prev.map(item => 
            item.id === pendingItem.id 
              ? { ...item, status: 'error' as const, error: error.message }
              : item
          ));
          
          toast.error(`Erro ao gerar mockup do pedido ${pendingItem.pedido.numero_pedido}`);
        } finally {
          processingRef.current = false;
          setIsProcessing(false);
        }
      })();
      
      return currentQueue.map(item => 
        item.id === pendingItem.id 
          ? { ...item, status: 'processing' as const }
          : item
      );
    });
  }, [onRefresh]);

  // Processar fila automaticamente quando houver itens pendentes
  useEffect(() => {
    if (!processingRef.current) {
      const hasPending = queue.some(item => item.status === 'pending');
      if (hasPending) {
        processQueue();
      }
    }
  }, [queue, processQueue]);

  // Limpar itens completados após 10 segundos
  useEffect(() => {
    const completedItems = queue.filter(item => item.status === 'completed' || item.status === 'error');
    if (completedItems.length > 0) {
      const timer = setTimeout(() => {
        setQueue(prev => prev.filter(item => item.status === 'pending' || item.status === 'processing'));
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [queue]);

  const pendingCount = queue.filter(item => item.status === 'pending').length;
  const processingItem = queue.find(item => item.status === 'processing');

  return {
    queue,
    addToQueue,
    isProcessing,
    pendingCount,
    processingItem,
    currentProcessingId: processingItem?.pedido?.id || null
  };
}
