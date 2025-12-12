import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, X, ExternalLink, HelpCircle, Image } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template?: any;
  onSuccess: () => void;
}

type Categoria = 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
type Status = 'pendente' | 'aprovado' | 'rejeitado';

// Variáveis pré-definidas do sistema
const VARIAVEIS_PREDEFINIDAS = [
  { key: 'nome_cliente', label: 'Nome do Cliente', exemplo: 'João Silva' },
  { key: 'numero_pedido', label: 'Número do Pedido', exemplo: '12345' },
  { key: 'codigo_produto', label: 'Código do Produto', exemplo: 'CANECA-001' },
  { key: 'data_pedido', label: 'Data do Pedido', exemplo: '10/12/2024' },
];

const CAMPOS_MIDIA = [
  { key: 'foto_aprovacao', label: 'Foto de Aprovação' },
  { key: 'fotos_cliente', label: 'Fotos do Cliente (primeira)' },
];

export const TemplateDialog = ({ open, onOpenChange, template, onSuccess }: TemplateDialogProps) => {
  const [nome, setNome] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [categoria, setCategoria] = useState<Categoria>("UTILITY");
  const [idioma, setIdioma] = useState("pt_BR");
  const [descricao, setDescricao] = useState("");
  const [variaveis, setVariaveis] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<Status>("pendente");
  const [hasHeaderMedia, setHasHeaderMedia] = useState(false);
  const [headerMediaField, setHeaderMediaField] = useState("foto_aprovacao");
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    if (open) {
      if (template) {
        setNome(template.nome || "");
        setTemplateName(template.template_name || "");
        setCategoria(template.categoria || "UTILITY");
        setIdioma(template.idioma || "pt_BR");
        setDescricao(template.descricao || "");
        setVariaveis(template.variaveis || []);
        setIsActive(template.is_active ?? true);
        setStatus(template.status || "pendente");
        setHasHeaderMedia(template.has_header_media || false);
        setHeaderMediaField(template.header_media_field || "foto_aprovacao");
      } else {
        setNome("");
        setTemplateName("");
        setCategoria("UTILITY");
        setIdioma("pt_BR");
        setDescricao("");
        setVariaveis([]);
        setIsActive(true);
        setStatus("pendente");
        setHasHeaderMedia(false);
        setHeaderMediaField("foto_aprovacao");
      }
      setHelpOpen(false);
    }
  }, [open, template]);

  const handleAddVariavel = (key: string) => {
    if (!variaveis.includes(key)) {
      setVariaveis([...variaveis, key]);
    }
  };

  const handleRemoveVariavel = (index: number) => {
    setVariaveis(variaveis.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!nome.trim()) {
      toast.error("Nome do template é obrigatório");
      return;
    }

    if (!templateName.trim()) {
      toast.error("Nome do template no Meta é obrigatório");
      return;
    }

    setIsLoading(true);

    try {
      const data = {
        nome: nome.trim(),
        template_name: templateName.trim().toLowerCase().replace(/\s+/g, '_'),
        categoria,
        idioma,
        descricao: descricao.trim() || null,
        variaveis,
        is_active: isActive,
        status,
        has_header_media: hasHeaderMedia,
        header_media_field: hasHeaderMedia ? headerMediaField : null,
      };

      if (template?.id) {
        const { error } = await supabase
          .from("whatsapp_templates")
          .update(data)
          .eq("id", template.id);

        if (error) throw error;
        toast.success("Template atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("whatsapp_templates")
          .insert([data]);

        if (error) throw error;
        toast.success("Template criado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar template:", error);
      toast.error("Erro ao salvar template: " + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Gerar pré-visualização
  const gerarPreview = () => {
    if (!descricao) return null;
    
    let preview = descricao;
    variaveis.forEach((v, index) => {
      const varInfo = VARIAVEIS_PREDEFINIDAS.find(p => p.key === v);
      const exemplo = varInfo?.exemplo || `[${v}]`;
      preview = preview.replace(new RegExp(`\\{\\{${index + 1}\\}\\}`, 'g'), `*${exemplo}*`);
      preview = preview.replace(new RegExp(`\\{\\{${v}\\}\\}`, 'gi'), `*${exemplo}*`);
    });
    return preview;
  };

  const getStatusColor = (s: Status) => {
    switch (s) {
      case 'aprovado': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'rejeitado': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar Template" : "Novo Template Meta"}
          </DialogTitle>
          <DialogDescription>
            Configure um template pré-aprovado do Meta Business Suite
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Documentação Inline */}
          <Collapsible open={helpOpen} onOpenChange={setHelpOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full justify-between">
                <span className="flex items-center gap-2">
                  <HelpCircle className="h-4 w-4" />
                  Como criar templates no Meta?
                </span>
                <span className="text-xs text-muted-foreground">
                  {helpOpen ? 'Fechar' : 'Ver instruções'}
                </span>
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-3">
                <p className="font-medium">Passo a passo:</p>
                <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                  <li>Acesse o <a href="https://business.facebook.com/wa/manage/message-templates/" target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-1">Meta Business Suite <ExternalLink className="h-3 w-3" /></a></li>
                  <li>Crie um novo template com categoria <strong>Utility</strong> (mais barato)</li>
                  <li>Use variáveis <strong>nomeadas</strong> como: <code className="bg-background px-1 rounded">{"{{numero_pedido}}"}</code></li>
                  <li>Se quiser imagem, adicione um <strong>Cabeçalho de Mídia</strong></li>
                  <li>Envie para aprovação e aguarde (geralmente 5-30 min)</li>
                  <li>Após aprovado, cadastre aqui usando o <strong>mesmo nome</strong> do template</li>
                </ol>
                <div className="bg-amber-500/10 border border-amber-200 rounded p-2 mt-2">
                  <p className="text-amber-700 dark:text-amber-300 text-xs">
                    <strong>Importante:</strong> As variáveis no Meta devem ser nomeadas (ex: {"{{numero_pedido}}"}), 
                    não numeradas ({"{{1}}"}). O sistema faz a conversão automaticamente.
                  </p>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome de Exibição *</Label>
              <Input
                id="nome"
                placeholder="Ex: Confirmação de Pedido"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status de Aprovação</Label>
              <Select value={status} onValueChange={(value: Status) => setStatus(value)}>
                <SelectTrigger className={getStatusColor(status)}>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">🟡 Pendente</SelectItem>
                  <SelectItem value="aprovado">🟢 Aprovado</SelectItem>
                  <SelectItem value="rejeitado">🔴 Rejeitado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-name">Nome do Template no Meta *</Label>
            <Input
              id="template-name"
              placeholder="Ex: confirmacao_pedido"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Exatamente como cadastrado no Meta (sem espaços, use underscores)
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoria *</Label>
              <Select value={categoria} onValueChange={(value: Categoria) => setCategoria(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility (Transacional) - Mais barato</SelectItem>
                  <SelectItem value="MARKETING">Marketing - Promoções</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication - Verificação</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="idioma">Idioma</Label>
              <Select value={idioma} onValueChange={setIdioma}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt_BR">Português (BR)</SelectItem>
                  <SelectItem value="en_US">English (US)</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Configuração de Mídia */}
          <div className="space-y-3 p-3 border rounded-lg bg-muted/30">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="has-media" 
                checked={hasHeaderMedia} 
                onCheckedChange={(checked) => setHasHeaderMedia(!!checked)}
              />
              <Label htmlFor="has-media" className="cursor-pointer flex items-center gap-2">
                <Image className="h-4 w-4" />
                Template com imagem de cabeçalho
              </Label>
            </div>
            
            {hasHeaderMedia && (
              <div className="pl-6 space-y-2">
                <Label htmlFor="media-field">Campo para mídia</Label>
                <Select value={headerMediaField} onValueChange={setHeaderMediaField}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {CAMPOS_MIDIA.map(campo => (
                      <SelectItem key={campo.key} value={campo.key}>
                        {campo.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  A imagem será enviada como cabeçalho do template
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Variáveis do Template</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Clique para adicionar as variáveis na ordem em que aparecem no template do Meta
            </p>
            
            <div className="flex flex-wrap gap-2">
              {VARIAVEIS_PREDEFINIDAS.map((v) => (
                <TooltipProvider key={v.key}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant={variaveis.includes(v.key) ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleAddVariavel(v.key)}
                        disabled={variaveis.includes(v.key)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        {v.label}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Exemplo: {v.exemplo}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>

            {variaveis.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3 p-3 bg-muted/50 rounded-lg">
                <span className="text-xs text-muted-foreground w-full mb-1">Ordem das variáveis:</span>
                {variaveis.map((v, index) => {
                  const varInfo = VARIAVEIS_PREDEFINIDAS.find(p => p.key === v);
                  return (
                    <Badge key={index} variant="secondary" className="gap-1 pr-1">
                      <span className="text-primary font-mono mr-1">{`{{${index + 1}}}`}</span>
                      {varInfo?.label || v}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 hover:bg-destructive/20"
                        onClick={() => handleRemoveVariavel(index)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Texto do Template (para referência e preview)</Label>
            <Textarea
              id="descricao"
              placeholder="Cole aqui o texto do template como cadastrado no Meta...&#10;Exemplo: Olá {{nome_cliente}}, seu pedido {{numero_pedido}} está pronto!"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
            />
          </div>

          {/* Pré-visualização */}
          {descricao && (
            <div className="space-y-2">
              <Label>Pré-visualização</Label>
              <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
                {hasHeaderMedia && (
                  <div className="mb-3 p-8 bg-muted rounded flex items-center justify-center text-muted-foreground">
                    <Image className="h-6 w-6 mr-2" />
                    [Imagem: {CAMPOS_MIDIA.find(c => c.key === headerMediaField)?.label}]
                  </div>
                )}
                <p className="whitespace-pre-wrap text-sm">
                  {gerarPreview()}
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between space-x-2 pt-2">
            <Label htmlFor="active" className="cursor-pointer">
              Template ativo
            </Label>
            <Switch
              id="active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};