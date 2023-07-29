import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 这意味着每当数据通过控制器Controller进入应用程序时，都会自动应用ValidationPipe进行验证
    app.useGlobalPipes(new ValidationPipe()); // 全局启用 ValidationPipe

    app.enableCors();

    const configService = app.get(ConfigService);
    await app.listen(configService.get('nest_server_port'));
}
bootstrap();
