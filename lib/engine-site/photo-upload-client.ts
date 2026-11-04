'use client';
import { ENGINE_PHOTO_MAX_BYTES } from './photo-policy';

/** Only ephemeral browser bytes. Re-encode before crossing the unchanged server upload boundary. */
export async function prepareEnginePhotoUpload(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1 || file.size > 25 * 1024 * 1024)
    throw Error('engine_photo_client_invalid');
  let source: CanvasImageSource, width: number, height: number, dispose: () => void;
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    source = bitmap; width = bitmap.width; height = bitmap.height; dispose = () => bitmap.close();
  } else {
    const url = URL.createObjectURL(file), image = new Image();
    try { await new Promise<void>((resolve,reject) => { image.onload=()=>resolve(); image.onerror=()=>reject(Error('engine_photo_client_decode')); image.src=url; }); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
    source = image; width=image.naturalWidth; height=image.naturalHeight; dispose=()=>{ URL.revokeObjectURL(url); image.src=''; };
  }
  try {
    if (width < 64 || height < 64 || !Number.isFinite(width + height)) throw Error('engine_photo_client_dimensions');
    const scale = Math.min(1, 2048 / Math.max(width,height)), canvas=document.createElement('canvas');
    canvas.width=Math.round(width*scale); canvas.height=Math.round(height*scale);
    const context=canvas.getContext('2d'); if(!context) throw Error('engine_photo_client_canvas');
    context.fillStyle='#ffffff'; context.fillRect(0,0,canvas.width,canvas.height); context.drawImage(source,0,0,canvas.width,canvas.height);
    for(const quality of [0.9,0.8,0.65]) {
      const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value ? resolve(value) : reject(Error('engine_photo_client_encode')),'image/jpeg',quality));
      if(blob.type==='image/jpeg' && blob.size>0 && blob.size<=ENGINE_PHOTO_MAX_BYTES) return blob;
    }
    throw Error('engine_photo_client_size');
  } finally { dispose(); }
}
