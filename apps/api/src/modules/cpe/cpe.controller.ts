import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { CpeService } from './cpe.service';
import { Admin, Escrita } from '../auth/auth.guard';
import { Auditar } from '../auth/auditoria.service';

@Controller('cpes')
export class CpeController {
  constructor(private readonly cpeService: CpeService) {}

  @Get()
  async findAll(@Query('search') search?: string) {
    return this.cpeService.listCpes(search);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.cpeService.getCpeById(id);
  }

  @Get(':id/parameters')
  async getParameters(@Param('id') id: string) {
    return this.cpeService.getParameters(id);
  }

  @Escrita()
  @Auditar('reiniciar', { freio: true })
  @Post(':id/reboot')
  async reboot(@Param('id') id: string) {
    return this.cpeService.reboot(id);
  }

  // Reset de fábrica apaga a configuração do cliente: só admin, e passa pelo freio.
  @Admin()
  @Auditar('reset de fábrica', { freio: true })
  @Post(':id/factory-reset')
  async factoryReset(@Param('id') id: string) {
    return this.cpeService.factoryReset(id);
  }

  @Escrita()
  @Auditar('wifi', { freio: true })
  @Post(':id/wifi')
  async configureWifi(
    @Param('id') id: string,
    @Body()
    body: {
      band: '2.4GHz' | '5GHz';
      ssid?: string;
      password?: string;
      channel?: number | 'auto';
    }
  ) {
    return this.cpeService.configureWifi(id, body.band, body);
  }

  @Post(':id/refresh')
  async refresh(@Param('id') id: string) {
    return this.cpeService.refresh(id);
  }
}
