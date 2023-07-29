import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from '@redis/client';
import { ConfigService } from '@nestjs/config/dist';

// 全局模块
// 不需要 imports RedisModule，然后其provider的service才能在使用RedisService
// 参考user/service/register
@Global()
@Module({
    providers: [
        RedisService,
        {
            provide: 'REDIS_CLIENT',
            async useFactory(configService: ConfigService) {
                console.log(configService.get('redis_server_host'));
                console.log(configService.get('redis_server_port'));

                const client = createClient({
                    socket: {
                        host: configService.get('redis_server_host'),
                        port: configService.get('redis_server_port'),
                    },
                    database: configService.get('redis_server_db'), // 命名空间，默认为0
                });
                await client.connect();
                return client;
            },
            inject: [ConfigService],
        },
    ],
    exports: [RedisService],
})
export class RedisModule {}
