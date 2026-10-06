import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { AiService, type PersonaId } from '../../ai/ai.service.js';

/**
 * Body of `POST /api/respond`: the user's transcribed message.
 *
 * */
export class RespondDto {
  @IsUUID()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  message: string;

  @IsOptional()
  @IsIn(AiService.PERSONA_IDS)
  persona?: PersonaId;
}
