import { Module } from '@nestjs/common';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { AuthModule } from '../auth/auth.module';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoGuard } from './integracao.guard';
import { ChavesIntegracaoController } from './chaves.controller';
import { ChavesIntegracaoService } from './chaves.service';

@Module({
  imports: [GenieacsModule, AuthModule],
  controllers: [IntegracaoController, ChavesIntegracaoController],
  providers: [IntegracaoGuard, ChavesIntegracaoService],
})
export class IntegracaoModule {}
