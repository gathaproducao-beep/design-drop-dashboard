import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";

interface ImageViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string | string[];
  title: string;
}

export function ImageViewDialog({
  open,
  onOpenChange,
  imageUrl,
  title,
}: ImageViewDialogProps) {
  const images = Array.isArray(imageUrl) ? imageUrl : [imageUrl];
  const [currentIndex, setCurrentIndex] = useState(0);

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = async () => {
    const currentImage = images[currentIndex];
    const fileName = currentImage.split('/').pop() || 'imagem.png';
    
    try {
      const response = await fetch(currentImage);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao baixar imagem:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div>
              {title}
              {images.length > 1 && (
                <span className="ml-2 text-sm text-muted-foreground">
                  ({currentIndex + 1}/{images.length})
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownload}
              className="ml-4"
            >
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
          </DialogTitle>
        </DialogHeader>
        <div className="relative w-full bg-muted rounded-lg overflow-hidden">
          <img
            src={images[currentIndex]}
            alt={`${title} - ${currentIndex + 1}`}
            className="w-full h-auto object-contain max-h-[70vh]"
          />
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90"
                onClick={handlePrevious}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 hover:bg-background/90"
                onClick={handleNext}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
