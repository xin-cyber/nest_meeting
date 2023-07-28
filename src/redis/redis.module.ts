import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { createClient } from '@redis/client';

// 全局模块
// 不需要 imports RedisModule，然后其provider的service才能在使用RedisService
// 参考user/service/register
@Global()
@Module({
    providers: [
        RedisService,
        {
            provide: 'REDIS_CLIENT',
            async useFactory() {
                const client = createClient({
                    socket: {
                        host: 'localhost',
                        port: 6379,
                    },
                    database: 1, // 命名空间，默认为0
                });
                await client.connect();
                return client;
            },
        },
    ],
    exports: [RedisService],
})
export class RedisModule {}
