import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { AiService, type Voice } from '../../ai/ai.service.js';

/**
 * Body of `POST /api/speak`. OpenAI's TTS accepts up to 4096 characters.
 *
 * */
export class SpeakDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  text: string;

  @IsOptional()
  @IsIn(AiService.VOICES)
  voice?: Voice;
}
