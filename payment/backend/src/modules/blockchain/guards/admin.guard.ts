import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.apiKey;

    if (!apiKey || !apiKey.permissions.includes('admin')) {
      throw new HttpException('Admin permission required', HttpStatus.FORBIDDEN);
    }

    return true;
  }
}