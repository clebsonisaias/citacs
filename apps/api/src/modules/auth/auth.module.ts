import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuthController, UsuariosController } from './auth.controller';

@Module({
  controllers: [AuthController, UsuariosController],
  providers: [AuthService, { provide: APP_GUARD, useClass: AuthGuard }],
})
export class AuthModule {}
