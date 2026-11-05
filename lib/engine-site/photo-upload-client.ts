'use client';
import { ENGINE_PHOTO_MAX_BYTES } from './photo-policy';
export const ENGINE_PHOTO_CLIENT_MAX_BYTES = 25 * 1024 * 1024;
const PHOTO_EDGE = 2048;

/** Read bounded container headers before decoding pixels, so phone photos decode at their target size. */
async function photoDimensions(file: File) {
  const bytes=new Uint8Array(await file.slice(0,256*1024).arrayBuffer()), view=new DataView(bytes.buffer);
  const tag=(offset:number,length:number)=>String.fromCharCode(...bytes.subarray(offset,offset+length));
  let width=0,height=0,orientation=1;
  if(bytes.length>=24&&view.getUint32(0)===0x89504e47&&tag(12,4)==='IHDR') {width=view.getUint32(16);height=view.getUint32(20);}
  else if(bytes.length>=30&&tag(0,4)==='RIFF'&&tag(8,4)==='WEBP') {
    const kind=tag(12,4);
    if(kind==='VP8X'){width=1+bytes[24]+256*bytes[25]+65536*bytes[26];height=1+bytes[27]+256*bytes[28]+65536*bytes[29];}
    else if(kind==='VP8L'&&bytes[20]===0x2f){const size=view.getUint32(21,true);width=1+(size&0x3fff);height=1+((size>>>14)&0x3fff);}
    else if(kind==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=view.getUint16(26,true)&0x3fff;height=view.getUint16(28,true)&0x3fff;}
  } else if(bytes.length>=4&&view.getUint16(0)===0xffd8) {
    for(let p=2;p+9<bytes.length;) {
      if(bytes[p]!==0xff)break;while(bytes[p]===0xff)p++;
      const marker=bytes[p++];if(marker===0xd9||marker===0xda)break;
      if(marker===1||marker>=0xd0&&marker<=0xd7)continue;
      if(p+2>bytes.length)break;const length=view.getUint16(p);if(length<2||p+length>bytes.length)break;
      if(marker===0xe1&&tag(p+2,6)==='Exif\0\0') {
        const t=p+8,little=tag(t,2)==='II';
        if(t+8<=p+length){const offset=t+view.getUint32(t+4,little);
          if(offset+2<=p+length){const count=Math.min(256,view.getUint16(offset,little));
            for(let n=0;n<count;n++){const e=offset+2+n*12;if(e+12>p+length)break;
              if(view.getUint16(e,little)===0x112&&view.getUint16(e+2,little)===3&&view.getUint32(e+4,little)===1)orientation=view.getUint16(e+8,little);}}}
      }
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) {height=view.getUint16(p+3);width=view.getUint16(p+5);break;}
      p+=length;
    }
  }
  if(orientation>=5&&orientation<=8)[width,height]=[height,width];
  if(width<64||height<64||width*height>80_000_000)throw Error('engine_photo_client_dimensions');
  const scale=Math.min(1,PHOTO_EDGE/Math.max(width,height));return {width:Math.round(width*scale),height:Math.round(height*scale)};
}

/** Only ephemeral browser bytes. Re-encode before crossing the unchanged server upload boundary. */
export async function prepareEnginePhotoUpload(file: File): Promise<Blob> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size < 1 || file.size > ENGINE_PHOTO_CLIENT_MAX_BYTES)
    throw Error('engine_photo_client_invalid');
  const target=await photoDimensions(file);
  let source: CanvasImageSource, width: number, height: number, dispose: () => void;
  let bitmap: ImageBitmap | null=null;
  if (typeof createImageBitmap === 'function') {
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image', resizeWidth:target.width, resizeHeight:target.height, resizeQuality:'high' }); }
    catch { /* Some mobile browsers reject bitmap options/types; use their image decoder instead. */ }
  }
  if(bitmap) {
    const decoded=bitmap; source = decoded; width = decoded.width; height = decoded.height; dispose = () => decoded.close();
  } else {
    const url = URL.createObjectURL(file), image = new Image();
    try { await new Promise<void>((resolve,reject) => { image.onload=()=>resolve(); image.onerror=()=>reject(Error('engine_photo_client_decode')); image.src=url; }); }
    catch (error) { URL.revokeObjectURL(url); throw error; }
    source = image; width=image.naturalWidth; height=image.naturalHeight; dispose=()=>{ URL.revokeObjectURL(url); image.src=''; };
  }
  try {
    if (width < 64 || height < 64 || !Number.isFinite(width + height)) throw Error('engine_photo_client_dimensions');
    const scale = Math.min(1, PHOTO_EDGE / Math.max(width,height)), canvas=document.createElement('canvas');
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
