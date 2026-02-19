
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. ' +
    'Please create a .env.local file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. ' +
    'See .env.example for reference.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Converte e comprime uma imagem para WebP ou JPEG no lado do cliente
 * Garante que imagens mobile (iPhone/Android) sejam comprimidas corretamente
 */
const compressImage = async (file: File): Promise<{ blob: Blob; ext: string }> => {
  return new Promise(async (resolve, reject) => {
    try {
      let imageSource: any = null;
      let width = 0;
      let height = 0;

      // Suporte para ImageOrientation e melhor performance em browsers modernos (incluindo iOS 15+)
      if ('createImageBitmap' in window) {
        try {
          // 'from-image' garante que a orientação EXIF do iPhone seja respeitada
          imageSource = await createImageBitmap(file, { imageOrientation: 'from-image' });
          width = imageSource.width;
          height = imageSource.height;
        } catch (e) {
          console.warn("createImageBitmap falhou, tentando fallback Image", e);
        }
      }

      if (!imageSource) {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.src = url;
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
        });
        width = img.width;
        height = img.height;
        imageSource = img;
        URL.revokeObjectURL(url);
      }

      if (!imageSource) throw new Error("Falha ao processar imagem");

      // Redimensionamos para um máximo razoável para web (1200px)
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

      // Limpa canvas e desenha
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imageSource, 0, 0, canvas.width, canvas.height);

      // Cleanup se for bitmap
      if (imageSource instanceof ImageBitmap) {
        imageSource.close();
      }

      // Tenta WebP primeiro (melhor compressão)
      // Se o browser não suportar, ele geralmente retorna PNG (que é enorme)
      // Por isso, validamos o mimetype do blob resultante
      canvas.toBlob(
        async (webpBlob) => {
          if (webpBlob && webpBlob.type === 'image/webp') {
            resolve({ blob: webpBlob, ext: 'webp' });
          } else {
            // Fallback para JPEG (muito melhor que PNG para fotos)
            canvas.toBlob(
              (jpgBlob) => {
                if (jpgBlob) resolve({ blob: jpgBlob, ext: 'jpg' });
                else reject(new Error('Falha na compressão JPEG'));
              },
              'image/jpeg',
              0.7 // Qualidade 0.7 para garantir arquivos na faixa de 100-200kb
            );
          }
        },
        'image/webp',
        0.75
      );
    } catch (error) {
      reject(error);
    }
  });
};

export const uploadImage = async (file: File, path: string): Promise<string | null> => {
  try {
    // Detecta se é imagem por tipo ou extensão (incluindo HEIC de iPhones)
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);

    if (isImage) {
      const { blob, ext } = await compressImage(file);

      const fileName = `${Math.random().toString(36).substring(2)}.${ext}`;
      const filePath = `${path}/${fileName}`;
      const bucketName = 'project-images';

      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(filePath, blob, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          cacheControl: '3600',
          upsert: false
        });

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
