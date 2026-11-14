import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenieacsModule } from './modules/genieacs/genieacs.module';
import { CpeModule } from './modules/cpe/cpe.module';
import { AiModule } from './modules/ai/ai.module';
import { AuthModule } from './modules/auth/auth.module';
import { SgpModule } from './modules/sgp/sgp.module';

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
  ],
})
export class AppModule {}
