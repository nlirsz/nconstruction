
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zozohlwhjqxittkpgikv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpvem9obHdoanF4aXR0a3BnaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzM3MzAsImV4cCI6MjA3OTMwOTczMH0.4yUK3w6R-fCDBOzFFf55naEkZoA6_clcmT96PLqleEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Converte e comprime uma imagem para WebP no lado do cliente
 */
const compressAndConvertToWebP = async (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1200; // Limite de resolução para web
        const MAX_HEIGHT = 1200;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha na conversão para WebP'));
          },
          'image/webp',
          0.8 // Qualidade 80% (equilíbrio ideal entre peso e nitidez)
        );
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

export const uploadImage = async (file: File, path: string): Promise<string | null> => {
  try {
    // Se for imagem, processa para WebP
    if (file.type.startsWith('image/')) {
      const webpBlob = await compressAndConvertToWebP(file);
      const fileName = `${Math.random().toString(36).substring(2)}.webp`;
      const filePath = `${path}/${fileName}`;
      const bucketName = 'project-images'; 
      
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, webpBlob, { contentType: 'image/webp' });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      return data.publicUrl;
    }

    // Fallback para outros tipos de arquivos
    return uploadFile(file, path);
  } catch (error) {
    console.error('Erro no upload/compressão:', error);
    return null;
  }
};

export const uploadFile = async (file: File, path: string): Promise<string | null> => {
  try {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${path}/${fileName}`;
    const bucketName = 'project-images'; 

    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from(bucketName).getPublicUrl(filePath);
    return data.publicUrl;
  } catch (error) {
    console.error('Error uploading file:', error);
    return null;
  }
};
