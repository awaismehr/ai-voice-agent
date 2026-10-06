import { BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

export const AUDIO_FIELD = 'audio';
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

/**
 * Parses the multipart `audio` field of `POST /api/transcribe` into memory.
 * Rejects oversized uploads and anything that isn't audio. Browsers label
 * MediaRecorder webm output as either `audio/webm` or `video/webm`.
 */
export class AudioUploadInterceptor extends FileInterceptor(AUDIO_FIELD, {
  storage: memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES },
  fileFilter: (_req, file, callback) =>
    file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm'
      ? callback(null, true)
      : callback(
          new BadRequestException('Upload must be an audio file.'),
          false,
        ),
}) {}
