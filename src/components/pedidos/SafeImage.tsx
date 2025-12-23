import { useState } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
}

/**
 * Componente de imagem seguro que mostra fallback quando a imagem não existe
 */
export function SafeImage({ src, alt, className, onClick }: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const handleError = () => {
    console.warn(`[SafeImage] Imagem não encontrada: ${src}`);
    setHasError(true);
    setIsLoading(false);
  };

  const handleLoad = () => {
    setIsLoading(false);
  };

  if (hasError) {
    return (
      <div 
        className={`flex items-center justify-center bg-muted border border-dashed border-muted-foreground/30 rounded ${className}`}
        onClick={onClick}
        title={`Imagem não encontrada: ${src}`}
      >
        <div className="flex flex-col items-center gap-1 text-muted-foreground">
          <ImageOff className="h-6 w-6" />
          <span className="text-xs">Não encontrada</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {isLoading && (
        <div className={`absolute inset-0 flex items-center justify-center bg-muted animate-pulse rounded ${className}`}>
          <span className="text-xs text-muted-foreground">Carregando...</span>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className={`${className} ${isLoading ? 'invisible' : 'visible'}`}
        onClick={onClick}
        onError={handleError}
        onLoad={handleLoad}
      />
    </div>
  );
}
