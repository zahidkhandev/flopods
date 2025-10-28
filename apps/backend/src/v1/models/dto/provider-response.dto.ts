import { ApiProperty } from '@nestjs/swagger';
import { LLMProvider } from '@flopods/schema';
import { Expose } from 'class-transformer';

export class ProviderInfoDto {
  @Expose()
  @ApiProperty({ enum: LLMProvider })
  provider!: LLMProvider;

  @Expose()
  @ApiProperty({ example: 'OpenAI' })
  displayName!: string;

  @Expose()
  @ApiProperty({ example: 15 })
  modelCount!: number;

  @Expose()
  @ApiProperty({ example: true })
  isAvailable!: boolean;

  @Expose()
  @ApiProperty({
    example: ['text', 'vision', 'function-calling', 'reasoning'],
    type: [String],
  })
  capabilities!: string[];
}
