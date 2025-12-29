import { Search, Plus, RefreshCw, Filter } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConversationStatus, STATUS_LABELS } from '@/types/atendimento';

interface AtendimentoHeaderProps {
  instances: { id: string; nome: string; is_active: boolean }[];
  profiles: { id: string; full_name: string }[];
  instanceFilter: string | null;
  statusFilter: ConversationStatus | null;
  assignedFilter: string | null;
  searchQuery: string;
  onInstanceChange: (value: string | null) => void;
  onStatusChange: (value: ConversationStatus | null) => void;
  onAssignedChange: (value: string | null) => void;
  onSearchChange: (value: string) => void;
  onNewConversation: () => void;
  onRefresh: () => void;
}

export function AtendimentoHeader({
  instances,
  profiles,
  instanceFilter,
  statusFilter,
  assignedFilter,
  searchQuery,
  onInstanceChange,
  onStatusChange,
  onAssignedChange,
  onSearchChange,
  onNewConversation,
  onRefresh
}: AtendimentoHeaderProps) {
  return (
    <div className="border-b bg-card p-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone ou mensagem..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filtro por instância */}
        <Select
          value={instanceFilter || 'all'}
          onValueChange={(value) => onInstanceChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Número WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os números</SelectItem>
            {instances.map(instance => (
              <SelectItem key={instance.id} value={instance.id}>
                {instance.nome} {!instance.is_active && '(inativo)'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por status */}
        <Select
          value={statusFilter || 'all'}
          onValueChange={(value) => onStatusChange(value === 'all' ? null : value as ConversationStatus)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por atendente */}
        <Select
          value={assignedFilter || 'all'}
          onValueChange={(value) => onAssignedChange(value === 'all' ? null : value)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Atendente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os atendentes</SelectItem>
            {profiles.map(profile => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.full_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ações */}
        <Button variant="outline" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>

        <Button onClick={onNewConversation}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Conversa
        </Button>
      </div>
    </div>
  );
}
