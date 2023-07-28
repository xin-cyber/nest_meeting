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

@Module({
    // import中导入的module的exports可以被providers中的services使用
    imports: [
        TypeOrmModule.forRoot({
            type: 'mysql',
            host: 'localhost',
            port: 3306,
            username: 'root',
            password: '123456',
            database: 'nest_meeting',
            synchronize: true,
            logging: false, // 建表日志
            entities: [Permission, Role, User],
            poolSize: 10,
            connectorPackage: 'mysql2',
            extra: {
                authPlugin: 'sha256_password',
            },
        }),
        UserModule,
        RedisModule,
        EmailModule,
    ],
    controllers: [AppController],
    providers: [AppService],
})
export class AppModule {}
