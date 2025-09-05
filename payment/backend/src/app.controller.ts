import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    @InjectConnection() private readonly connection: Connection
  ) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('health')
  async getHealth() {
    try {
      // Check database connection
      const dbState = this.connection.readyState;
      const dbStatus = dbState === 1 ? 'connected' : 'disconnected';
      
      return {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: {
          status: dbStatus,
          readyState: dbState
        },
        environment: process.env.NODE_ENV || 'development'
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
        environment: process.env.NODE_ENV || 'development'
      };
    }
  }
}
