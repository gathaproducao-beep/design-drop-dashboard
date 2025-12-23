import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Retorna a data atual no fuso horário de Brasília (America/Sao_Paulo)
 * no formato YYYY-MM-DD para uso em inputs type="date"
 */
export function getDataBrasilia(): string {
  // Criar uma data baseada no horário UTC atual
  const now = new Date();
  
  // Obter os componentes da data no fuso de Brasília
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  };
  
  // Usar formatToParts para garantir formato correto
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(now);
  const year = parts.find(p => p.type === 'year')?.value;
  const month = parts.find(p => p.type === 'month')?.value;
  const day = parts.find(p => p.type === 'day')?.value;
  
  return `${year}-${month}-${day}`; // Formato: YYYY-MM-DD
}

/**
 * Formata uma data para exibição no padrão brasileiro (DD/MM/YYYY)
 * considerando o fuso horário de Brasília
 */
export function formatarDataBrasilia(data: string | Date): string {
  const date = typeof data === 'string' ? new Date(data + 'T12:00:00') : data;
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  return formatter.format(date);
}
