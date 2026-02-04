
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://zozohlwhjqxittkpgikv.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpvem9obHdoanF4aXR0a3BnaWt2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3MzM3MzAsImV4cCI6MjA3OTMwOTczMH0.4yUK3w6R-fCDBOzFFf55naEkZoA6_clcmT96PLqleEY';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Converte e comprime uma imagem para WebP no lado do cliente
 */
const compressAndConvertToWebP = async (file: File): Promise<Blob> => {
  return new Promise(async (resolve, reject) => {
    try {
      let imageBitmap: ImageBitmap | null = null;
      let width = 0;
      let height = 0;

      // Prefer createImageBitmap for performance (off-main-thread decoding in some browsers)
      if ('createImageBitmap' in window) {
        imageBitmap = await createImageBitmap(file);
        width = imageBitmap.width;
        height = imageBitmap.height;
      } else {
        // Fallback for older browsers
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise((res) => (img.onload = res));
        width = img.width;
        height = img.height;
        imageBitmap = img as any; // Cast to satisfy type, although logic differs slightly
      }

      if (!imageBitmap) throw new Error("Falha ao processar imagem");

      const MAX_WIDTH = 1200;
      const MAX_HEIGHT = 1200;

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

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(width);
      canvas.height = Math.floor(height);
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error("Contexto 2D indisponível");

      // Draw image/bitmap
      ctx.drawImage(imageBitmap as any, 0, 0, canvas.width, canvas.height);

      // Cleanup bitmap to free memory immediately
      if (imageBitmap && 'close' in imageBitmap) {
        (imageBitmap as ImageBitmap).close();
      }

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Falha na conversão para WebP'));
        },
        'image/webp',
        0.75 // Slightly reduced quality for better performance/size ratio on mobile
      );
    } catch (error) {
      reject(error);
    }
  });
};

export const uploadImage = async (file: File, path: string): Promise<string | null> => {
  try {
    // Check if it's an image by MIME type OR file extension
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);

    if (isImage) {
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
