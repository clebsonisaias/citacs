import { Module } from '@nestjs/common';
import { CpeService } from './cpe.service';
import { CpeController } from './cpe.controller';
import { GenieacsModule } from '../genieacs/genieacs.module';

@Module({
  imports: [GenieacsModule],
  controllers: [CpeController],
  providers: [CpeService],
  exports: [CpeService],
})
export class CpeModule {}
