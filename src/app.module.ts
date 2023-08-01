import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { TypeOrmModule } from '@nestjs/typeorm';
import { UserModule } from './user/user.module';
import { Permission } from './user/entities/permission.entity';
import { Role } from './user/entities/role.entity';
import { User } from './user/entities/user.entity';
import { RedisModule } from './redis/redis.module';
import { EmailModule } from './email/email.module';

import { ConfigModule } from '@nestjs/config';
import { ConfigService } from '@nestjs/config';

import { JwtModule } from '@nestjs/jwt';

import { APP_GUARD } from '@nestjs/core';
import { LoginGuard } from './login.guard';
import { PermissionGuard } from './permission.guard';

@Module({
    // import中导入的module的exports可以被providers中的services使用
    imports: [
        TypeOrmModule.forRootAsync({
            useFactory(configService: ConfigService) {
                return {
                    type: 'mysql',
                    host: configService.get('mysql_server_host'),
                    port: configService.get('mysql_server_port'),
                    username: configService.get('mysql_server_username'),
                    password: configService.get('mysql_server_password'),
                    database: configService.get('mysql_server_database'),
                    synchronize: true,
                    logging: false,
                    entities: [User, Role, Permission],
                    poolSize: 10,
                    connectorPackage: 'mysql2',
                    extra: {
                        authPlugin: 'sha256_password',
                    },
                };
            },
            inject: [ConfigService],
        }),
        JwtModule.registerAsync({
            global: true,
            useFactory(configService: ConfigService) {
                return {
                    secret: configService.get('jwt_secret'),
                    signOptions: {
                        expiresIn: '30m', // 默认 30 分钟
                    },
                };
            },
            inject: [ConfigService],
        }),

        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: 'src/.env',
        }),
        UserModule,
        RedisModule,
        EmailModule,
    ],
    controllers: [AppController],
    providers: [
        AppService,
        // 全局guard
        {
            provide: APP_GUARD,
            useClass: LoginGuard,
        },
        {
            provide: APP_GUARD,
            useClass: PermissionGuard,
        },
    ],
})
export class AppModule {}
