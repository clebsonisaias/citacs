import { Module } from '@nestjs/common';
import { GenieacsModule } from '../genieacs/genieacs.module';
import { ClienteController, SgpService } from './sgp.service';

@Module({
  imports: [GenieacsModule],
  controllers: [ClienteController],
  providers: [SgpService],
  exports: [SgpService],
})
export class SgpModule {}
