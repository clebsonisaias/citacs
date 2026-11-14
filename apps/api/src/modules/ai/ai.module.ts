import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { SgpModule } from '../sgp/sgp.module';

@Module({
  imports: [GenieacsModule, SgpModule],
  controllers: [AiController],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
