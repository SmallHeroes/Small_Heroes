/**
 * Browser child photo compression — keep in sync with lib/child-photo-client.ts
 */
(function bootstrapChildPhotoClient(global) {
  if (global.SmallHeroesChildPhoto && typeof global.SmallHeroesChildPhoto.fileToChildPhotoDataUrl === 'function') {
    return;
  }

  var MAX_SOURCE_PHOTO_BYTES = 15 * 1024 * 1024;
  var MAX_CHILD_PHOTO_DATA_URL_CHARS = 3200000;
  var CHILD_PHOTO_MAX_DIMENSION = 1600;
  var CHILD_PHOTO_JPEG_QUALITIES = [0.86, 0.78, 0.68];
  var CHILD_PHOTO_TOO_LARGE_HE = 'התמונה גדולה מדי — נסה תמונה קטנה יותר';

  function readJsonResponse(res, options) {
    options = options || {};
    var payloadTooLargeMessage = options.payloadTooLargeMessage || CHILD_PHOTO_TOO_LARGE_HE;
    return res.text().then(function (text) {
      var trimmed = (text || '').trim();
      if (!trimmed) return {};

      try {
        return JSON.parse(trimmed);
      } catch (_e) {
        if (res.status === 413 || /^Request Entity Too Large/i.test(trimmed)) {
          throw new Error(payloadTooLargeMessage);
        }
        var plainText = trimmed
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .slice(0, 240);
        throw new Error(plainText || 'Request failed (' + res.status + ')');
      }
    });
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var objectUrl = URL.createObjectURL(file);
      var image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Could not read photo file'));
      };
      image.src = objectUrl;
    });
  }

  function fileToChildPhotoDataUrl(file) {
    if (file.size > MAX_SOURCE_PHOTO_BYTES) {
      return Promise.reject(new Error('Child photo is too large. Use an image under 15 MB.'));
    }

    return loadImageFromFile(file).then(function (image) {
      var naturalWidth = image.naturalWidth || image.width;
      var naturalHeight = image.naturalHeight || image.height;
      if (!naturalWidth || !naturalHeight) {
        throw new Error('Could not read photo dimensions');
      }

      var scale = Math.min(1, CHILD_PHOTO_MAX_DIMENSION / Math.max(naturalWidth, naturalHeight));
      var canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(naturalHeight * scale));

      var ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not prepare photo for upload');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

      for (var i = 0; i < CHILD_PHOTO_JPEG_QUALITIES.length; i++) {
        var quality = CHILD_PHOTO_JPEG_QUALITIES[i];
        var dataUrl = canvas.toDataURL('image/jpeg', quality);
        if (dataUrl.length <= MAX_CHILD_PHOTO_DATA_URL_CHARS) return dataUrl;
      }

      throw new Error('Child photo is still too large after compression. Use a smaller image.');
    });
  }

  function childPhotoUploadErrorHe(error) {
    var msg = error && error.message ? error.message : String(error || '');
    if (/still too large after compression/i.test(msg) || /too large/i.test(msg)) {
      return CHILD_PHOTO_TOO_LARGE_HE;
    }
    if (/Could not read photo/i.test(msg)) {
      return 'לא הצלחנו לקרוא את הקובץ הזה. נסו תמונה אחרת.';
    }
    if (/Could not read photo dimensions/i.test(msg)) {
      return 'לא הצלחנו לקרוא את מידות התמונה. נסו תמונה אחרת.';
    }
    if (/Could not prepare photo/i.test(msg)) {
      return 'לא הצלחנו להכין את התמונה להעלאה. נסו תמונה אחרת.';
    }
    return msg || CHILD_PHOTO_TOO_LARGE_HE;
  }

  var api = {
    MAX_SOURCE_PHOTO_BYTES: MAX_SOURCE_PHOTO_BYTES,
    MAX_CHILD_PHOTO_DATA_URL_CHARS: MAX_CHILD_PHOTO_DATA_URL_CHARS,
    CHILD_PHOTO_TOO_LARGE_HE: CHILD_PHOTO_TOO_LARGE_HE,
    readJsonResponse: readJsonResponse,
    loadImageFromFile: loadImageFromFile,
    fileToChildPhotoDataUrl: fileToChildPhotoDataUrl,
    childPhotoUploadErrorHe: childPhotoUploadErrorHe,
  };
  Object.freeze(api);
  global.SmallHeroesChildPhoto = api;
})(window);
