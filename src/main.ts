import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    // 这意味着每当数据通过控制器Controller进入应用程序时，都会自动应用ValidationPipe进行验证
    app.useGlobalPipes(new ValidationPipe()); // 全局启用 ValidationPipe

    app.enableCors();
    await app.listen(3000);
}
bootstrap();
