/**
 * 使用多种方法检测文件类型（主要使用Sharp库）
 * @param {Buffer} buffer 文件缓冲区
 * @returns {Promise<Object>} 包含 mimeType 和 extension 的对象
 */
export async function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) {
    return { mimeType: null, extension: null };
  }

  // 首先尝试使用Sharp检测图片类型
  try {
    const sharp = (await import('sharp')).default;
    const metadata = await sharp(buffer).metadata();
    
    if (metadata.format) {
      // Sharp支持的格式映射
      const formatMap = {
        'jpeg': { mimeType: 'image/jpeg', extension: 'jpg' },
        'png': { mimeType: 'image/png', extension: 'png' },
        'webp': { mimeType: 'image/webp', extension: 'webp' },
        'gif': { mimeType: 'image/gif', extension: 'gif' },
        'tiff': { mimeType: 'image/tiff', extension: 'tiff' },
        'avif': { mimeType: 'image/avif', extension: 'avif' },
        'heif': { mimeType: 'image/heif', extension: 'heif' },
        'svg': { mimeType: 'image/svg+xml', extension: 'svg' }
      };

      const result = formatMap[metadata.format];
      if (result) {
        return result;
      }
    }
  } catch (error) {
    // Sharp无法处理，继续尝试其他方法
  }

  // 检查SVG文件（Sharp可能无法处理所有SVG）
  try {
    const textContent = buffer.toString('utf8', 0, Math.min(buffer.length, 1024));
    if (textContent.includes('<svg') || (textContent.includes('<?xml') && textContent.includes('svg'))) {
      const svgPattern = /<svg[\s\S]*?>/i;
      if (svgPattern.test(textContent)) {
        return { mimeType: 'image/svg+xml', extension: 'svg' };
      }
    }
  } catch (error) {
    // 忽略编码错误
  }

  // 音频文件魔数检测（保留原有逻辑）
  const signature = buffer.subarray(0, 12);
  
  // MP3: ID3标签或MPEG帧同步
  if ((signature[0] === 0x49 && signature[1] === 0x44 && signature[2] === 0x33) || // ID3
      (signature[0] === 0xFF && (signature[1] & 0xE0) === 0xE0)) { // MPEG sync
    return { mimeType: 'audio/mpeg', extension: 'mp3' };
  }

  // WAV: 52 49 46 46 ... 57 41 56 45
  if (signature[0] === 0x52 && signature[1] === 0x49 && signature[2] === 0x46 && signature[3] === 0x46 &&
      buffer.length > 11 && signature[8] === 0x57 && signature[9] === 0x41 && signature[10] === 0x56 && signature[11] === 0x45) {
    return { mimeType: 'audio/wav', extension: 'wav' };
  }

  // OGG: 4F 67 67 53
  if (signature[0] === 0x4F && signature[1] === 0x67 && signature[2] === 0x67 && signature[3] === 0x53) {
    return { mimeType: 'audio/ogg', extension: 'ogg' };
  }

  // FLAC: 66 4C 61 43
  if (signature[0] === 0x66 && signature[1] === 0x4C && signature[2] === 0x61 && signature[3] === 0x43) {
    return { mimeType: 'audio/flac', extension: 'flac' };
  }

  // AAC: FF F1 或 FF F9 (ADTS header)
  if (signature[0] === 0xFF && (signature[1] === 0xF1 || signature[1] === 0xF9)) {
    return { mimeType: 'audio/aac', extension: 'aac' };
  }

  return { mimeType: null, extension: null };
}