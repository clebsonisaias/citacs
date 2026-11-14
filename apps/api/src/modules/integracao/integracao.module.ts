import { Module } from '@nestjs/common';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { AuthModule } from '../auth/auth.module';
import { IntegracaoController } from './integracao.controller';
import { IntegracaoGuard } from './integracao.guard';

@Module({
  imports: [GenieacsModule, AuthModule],
  controllers: [IntegracaoController],
  providers: [IntegracaoGuard],
})
export class IntegracaoModule {}
