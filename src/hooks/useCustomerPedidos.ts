import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Pedido } from '@/types/atendimento';

export function useCustomerPedidos(phone: string | null) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!phone) {
      setPedidos([]);
      return;
    }

    const fetchPedidos = async () => {
      setLoading(true);
      try {
        // Normalizar telefone para busca
        const cleanPhone = phone.replace(/\D/g, '');
        const phoneWithoutCountry = cleanPhone.startsWith('55') ? cleanPhone.substring(2) : cleanPhone;

        const { data, error } = await supabase
          .from('pedidos')
          .select('id, numero_pedido, nome_cliente, codigo_produto, telefone, data_pedido, layout_aprovado, mensagem_enviada, observacao, foto_aprovacao')
          .or(`telefone.ilike.%${cleanPhone}%,telefone.ilike.%${phoneWithoutCountry}%`)
          .order('data_pedido', { ascending: false });

        if (error) throw error;
        setPedidos(data || []);
      } catch (error) {
        console.error('Erro ao buscar pedidos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPedidos();
  }, [phone]);

  const updatePedidoStatus = async (pedidoId: string, field: 'layout_aprovado', value: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ [field]: value })
        .eq('id', pedidoId);

      if (error) throw error;

      // Atualizar localmente
      setPedidos(prev => prev.map(p => 
        p.id === pedidoId ? { ...p, [field]: value } : p
      ));

      // Registrar na auditoria
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();

      await supabase.from('whatsapp_audit_log').insert({
        user_id: user?.id,
        user_name: profile?.full_name,
        action: value === 'aprovado' ? 'aprovou_pedido' : 'reprovou_pedido',
        entity_type: 'pedido',
        entity_id: pedidoId,
        details: { field, value }
      });

      return true;
    } catch (error) {
      console.error('Erro ao atualizar pedido:', error);
      return false;
    }
  };

  return { pedidos, loading, updatePedidoStatus };
}
