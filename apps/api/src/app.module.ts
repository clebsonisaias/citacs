import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenieacsModule } from './modules/genieacs/genieacs.module';
import { CpeModule } from './modules/cpe/cpe.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { SgpModule } from './modules/sgp/sgp.module';
import { IntegracaoModule } from './modules/integracao/integracao.module';
import { SaudeModule } from './modules/saude/saude.module';
import { ZtpModule } from './modules/ztp/ztp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    AuthModule,
    GenieacsModule,
    CpeModule,
    AiModule,
    SgpModule,
    IntegracaoModule,
    SaudeModule,
    ZtpModule,
  ],
})
export class AppModule {}
