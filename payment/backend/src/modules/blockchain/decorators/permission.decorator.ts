import { SetMetadata } from '@nestjs/common';
import { ApiKeyPermission } from '../interfaces/api-key.interface';

export const RequirePermission = (permission: ApiKeyPermission) => SetMetadata('permission', permission);