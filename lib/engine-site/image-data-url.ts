import { engineSiteFail } from './contract';
/** Derive the wire MIME from the immutable bytes. Canonical private photos are JPEG; generated frames are PNG. */
export function engineImageDataUrl(bytes: Buffer) {
  const mime = bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
    : bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ? 'image/jpeg'
      : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP' ? 'image/webp' : null;
  if (!mime) engineSiteFail('engine_image_mime_invalid');
  return `data:${mime};base64,${bytes.toString('base64')}`;
}
