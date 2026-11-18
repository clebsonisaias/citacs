import { Body, Controller, Get, Post } from '@nestjs/common';
import { FirmwareService } from './firmware.service';

@Controller('firmwares')
export class FirmwareController {
  constructor(private readonly firmwareService: FirmwareService) {}

  @Get('inventario')
  async obterInventario() {
    return this.firmwareService.inventarioVersoes();
  }

  @Get('campanhas')
  async listarCampanhas() {
    return this.firmwareService.listarCampanhas();
  }

  @Post('campanhas')
  async criarCampanha(@Body() body: any) {
    return this.firmwareService.criarCampanha(body);
  }
}
