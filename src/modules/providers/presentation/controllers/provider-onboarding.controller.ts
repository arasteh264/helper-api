import {
  Body,
  Controller,
  Header,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { CompleteProviderOnboardingDto } from '../../application/dto/complete-provider-onboarding.dto';
import { ProviderOnboardingService } from '../../application/provider-onboarding.service';

@ApiTags('Provider onboarding')
@Controller('providers/onboarding')
export class ProviderOnboardingController {
  constructor(
    private readonly providerOnboardingService: ProviderOnboardingService,
  ) {}

  @ApiOperation({
    summary: 'Complete provider registration using a one-time SMS invitation',
  })
  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  complete(@Body() dto: CompleteProviderOnboardingDto) {
    return this.providerOnboardingService.completeOnboarding(dto);
  }
}
