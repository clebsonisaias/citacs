import { Controller, Get, Post, Param, Query, Body } from '@nestjs/common';
import { CpeService } from './cpe.service';

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

  @Post(':id/reboot')
  async reboot(@Param('id') id: string) {
    return this.cpeService.reboot(id);
  }

  @Post(':id/factory-reset')
  async factoryReset(@Param('id') id: string) {
    return this.cpeService.factoryReset(id);
  }

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
