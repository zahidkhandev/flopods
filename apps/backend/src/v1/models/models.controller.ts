import { Controller, Get, Param, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { V1ModelsService } from './models.service';
import { ModelPricingDto, ModelsByProviderDto } from './dto/model-response.dto';
import { ProviderInfoDto } from './dto/provider-response.dto';
import { LLMProvider } from '@actopod/schema';
import { Public } from '../../common/decorators/common';

@ApiTags('Models & Providers')
@Controller('models')
export class V1ModelsController {
  constructor(private readonly modelsService: V1ModelsService) {}

  @Get('providers')
  @Public()
  @ApiOperation({
    summary: 'Get all available LLM providers',
    description: 'Returns list of all providers with their capabilities and model counts',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of providers',
    type: [ProviderInfoDto],
  })
  async getAllProviders(): Promise<ProviderInfoDto[]> {
    return this.modelsService.getAllProviders();
  }

  @Get()
  @Public() // Make this public so frontend can show models in UI
  @ApiOperation({
    summary: 'Get all available models',
    description: 'Returns all active models with pricing and capabilities',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of all models',
    type: [ModelPricingDto],
  })
  async getAllModels(): Promise<ModelPricingDto[]> {
    return this.modelsService.getAllModels();
  }

  @Get('grouped')
  @Public()
  @ApiOperation({
    summary: 'Get models grouped by provider',
    description: 'Returns models organized by provider',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Models grouped by provider',
    type: [ModelsByProviderDto],
  })
  async getModelsGroupedByProvider(): Promise<ModelsByProviderDto[]> {
    return this.modelsService.getModelsGroupedByProvider();
  }

  @Get('provider/:provider')
  @Public()
  @ApiOperation({
    summary: 'Get models for specific provider',
    description: 'Returns all models for the specified provider',
  })
  @ApiParam({
    name: 'provider',
    enum: LLMProvider,
    description: 'LLM provider name',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Models for the provider',
    type: ModelsByProviderDto,
  })
  async getModelsByProvider(
    @Param('provider') provider: LLMProvider,
  ): Promise<ModelsByProviderDto> {
    return this.modelsService.getModelsByProvider(provider);
  }

  @Get('provider/:provider/:modelId')
  @Public()
  @ApiOperation({
    summary: 'Get specific model details',
    description: 'Returns detailed information about a specific model',
  })
  @ApiParam({
    name: 'provider',
    enum: LLMProvider,
    description: 'LLM provider name',
  })
  @ApiParam({
    name: 'modelId',
    description: 'Model ID',
    example: 'gpt-4o',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Model details',
    type: ModelPricingDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Model not found',
  })
  async getModelById(
    @Param('provider') provider: LLMProvider,
    @Param('modelId') modelId: string,
  ): Promise<ModelPricingDto | null> {
    return this.modelsService.getModelById(provider, modelId);
  }
}
