import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { FormatResponseInterceptor } from './format-response.interceptor';
import { InvokeRecordInterceptor } from './invoke-record.interceptor';
import { UnloginFilter } from './unlogin.filter';
import { CustomExceptionFilter } from './custom-exception.filter';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.useGlobalInterceptors(new FormatResponseInterceptor());
    app.useGlobalInterceptors(new InvokeRecordInterceptor());

    // 这意味着每当数据通过控制器Controller进入应用程序时，都会自动应用ValidationPipe进行验证
    app.useGlobalPipes(new ValidationPipe()); // 全局启用 ValidationPipe

    // app.useGlobalFilters(new UnloginFilter()); // 统一异常抛出格式
    app.useGlobalFilters(new CustomExceptionFilter());

    // swagger 文档生成
    const config = new DocumentBuilder()
        .setTitle('会议室预订系统')
        .setDescription('api 接口文档')
        .setVersion('1.0')
        .addBearerAuth({
            type: 'http',
            description: '基于 jwt 的认证',
        })
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-doc', app, document);

    app.enableCors();
    const configService = app.get(ConfigService);
    await app.listen(configService.get('nest_server_port'));
}
bootstrap();
