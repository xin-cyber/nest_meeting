// 路由鉴权
import {
    CanActivate,
    ExecutionContext,
    Inject,
    Injectable,
    UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { Permission } from './user/entities/permission.entity';

interface JwtUserData {
    userId: number;
    username: string;
    roles: string[];
    permissions: Permission[];
}

// 给Request这个class新增类型user
// typescript 里同名 module 和 interface 会自动合并，可以这样扩展类型
declare module 'express' {
    interface Request {
        user: JwtUserData;
    }
}

@Injectable()
export class LoginGuard implements CanActivate {
    @Inject()
    private reflector: Reflector;

    @Inject(JwtService)
    private jwtService: JwtService;

    canActivate(
        context: ExecutionContext,
    ): boolean | Promise<boolean> | Observable<boolean> {
        const request: Request = context.switchToHttp().getRequest();

        // 取出自定义装饰器的metadata信息
        const requireLogin = this.reflector.getAllAndOverride('require-login', [
            context.getClass(),
            context.getHandler(),
        ]);

        if (!requireLogin) {
            return true;
        }

        const authorization = request.headers.authorization;

        if (!authorization) {
            throw new UnauthorizedException('用户未登录');
        }

        try {
            const token = authorization.split(' ')[1];
            const data = this.jwtService.verify<JwtUserData>(token);

            // 在后续的请求处理中能够方便地访问到用户的信息。
            request.user = {
                userId: data.userId,
                username: data.username,
                roles: data.roles,
                permissions: data.permissions,
            };
            return true;
        } catch (e) {
            throw new UnauthorizedException('token 失效，请重新登录');
        }
    }
}
