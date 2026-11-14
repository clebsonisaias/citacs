import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AuthService } from './auth.service';
import { AuthGuard } from './auth.guard';
import { AuditoriaController, AuthController, UsuariosController } from './auth.controller';
import { AuditoriaInterceptor, AuditoriaService } from './auditoria.service';

@Module({
  controllers: [AuthController, UsuariosController, AuditoriaController],
  providers: [
    AuthService,
    AuditoriaService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_INTERCEPTOR, useClass: AuditoriaInterceptor },
  ],
})
export class AuthModule {}
