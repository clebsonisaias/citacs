import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GenieacsModule } from './modules/genieacs/genieacs.module';
import { CpeModule } from './modules/cpe/cpe.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    GenieacsModule,
    CpeModule,
    AiModule,
  ],
})
export class AppModule {}
