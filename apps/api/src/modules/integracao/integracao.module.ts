import { Module } from '@nestjs/common';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { AuthModule } from '../auth/auth.module';
import { SgpModule } from '../sgp/sgp.module';
import { CpeModule } from '../cpe/cpe.module';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoGuard } from './integracao.guard';
import { ChavesIntegracaoController } from './chaves.controller';
import { ChavesIntegracaoService } from './chaves.service';
import { WahaController } from './waha.controller';
import { WahaService } from './waha.service';

@Module({
  imports: [GenieacsModule, AuthModule, SgpModule, CpeModule],
  controllers: [IntegracaoController, ChavesIntegracaoController, WahaController],
  providers: [IntegracaoGuard, ChavesIntegracaoService, WahaService],
  exports: [WahaService],
})
export class IntegracaoModule {}
