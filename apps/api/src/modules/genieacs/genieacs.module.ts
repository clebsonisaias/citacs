import { Module } from '@nestjs/common';
import { GenieacsService } from './genieacs.service';

@Module({
  providers: [GenieacsService],
  exports: [GenieacsService],
})
export class GenieacsModule {}
