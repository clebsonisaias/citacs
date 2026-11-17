import { Module } from '@nestjs/common';
import { CpeService } from './cpe.service';
import { CpeController } from './cpe.controller';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { SgpModule } from '../sgp/sgp.module';

@Module({
  imports: [GenieacsModule, SgpModule],
  controllers: [CpeController],
  providers: [CpeService],
  exports: [CpeService],
})
export class CpeModule {}
