import { Module } from '@nestjs/common';
import { ZtpController } from './ztp.controller';
import { ZtpService } from './ztp.service';
import { SgpModule } from '../sgp/sgp.module';
import { GenieacsModule } from '../genieacs/genieacs.module';

@Module({
  imports: [SgpModule, GenieacsModule],
  controllers: [ZtpController],
  providers: [ZtpService],
  exports: [ZtpService],
})
export class ZtpModule {}
