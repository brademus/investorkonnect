/**
 * File validation utility for uploads across the app
 * Provides centralized validation for file types and sizes
 */

const FILE_LIMITS = {
  PDF_MAX_BYTES: 15 * 1024 * 1024, // 15MB
  IMAGE_MAX_BYTES: 10 * 1024 * 1024, // 10MB
};

const ALLOWED_TYPES = {
  PDF: ['application/pdf'],
  IMAGE: ['image/jpeg', 'image/jpg', 'image/png', 'image/heic', 'image/webp'],
  SAFE_DOCUMENTS: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

/**
 * Validate a file against type and size constraints
 * @param {Object} params
 * @param {File} params.file - The file to validate
 * @param {string[]} params.allowedMimeTypes - Array of allowed MIME types
 * @param {string[]} params.allowedExtensions - Optional array of allowed file extensions
 * @param {number} params.maxBytes - Maximum file size in bytes
 * @returns {Object} { valid: boolean, error: string | null }
 */
export function validateFile({ file, allowedMimeTypes, allowedExtensions, maxBytes }) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file size
  if (file.size > maxBytes) {
    const maxMB = (maxBytes / (1024 * 1024)).toFixed(0);
    const fileMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File is too large (${fileMB}MB). Maximum size is ${maxMB}MB.`,
    };
  }

  // Check MIME type
  if (!allowedMimeTypes.includes(file.type)) {
    const allowedNames = allowedMimeTypes
      .map(type => {
        if (type.includes('pdf')) return 'PDF';
        if (type.includes('image')) return type.split('/')[1].toUpperCase();
        return type.split('/')[1];
      })
      .join(', ');
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${allowedNames}`,
    };
  }

  // Check extension if provided
  if (allowedExtensions && allowedExtensions.length > 0) {
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!extension || !allowedExtensions.includes(extension)) {
      return {
        valid: false,
        error: `Invalid file extension. Allowed: ${allowedExtensions.join(', ')}`,
      };
    }
  }

  return { valid: true, error: null };
}

/**
 * Validate PDF file (contracts, agreements)
 */
export function validatePDF(file) {
  return validateFile({
    file,
    allowedMimeTypes: ALLOWED_TYPES.PDF,
    maxBytes: FILE_LIMITS.PDF_MAX_BYTES,
  });
}

/**
 * Validate image file (photos, headshots)
 */
export function validateImage(file) {
  return validateFile({
    file,
    allowedMimeTypes: ALLOWED_TYPES.IMAGE,
    maxBytes: FILE_LIMITS.IMAGE_MAX_BYTES,
  });
}

/**
 * Validate safe document files (no executables)
 */
export function validateSafeDocument(file) {
  return validateFile({
    file,
    allowedMimeTypes: ALLOWED_TYPES.SAFE_DOCUMENTS,
    maxBytes: FILE_LIMITS.PDF_MAX_BYTES,
  });
}