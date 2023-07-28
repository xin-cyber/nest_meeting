import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Inject,
    Query,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { EmailService } from '../email/email.service';
import { RedisService } from 'src/redis/redis.service';

@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Inject(EmailService)
    private emailService: EmailService;

    @Inject(RedisService)
    private redisService: RedisService;

    @Post('register')
    // 将请求体注入到register方法的参数register中，等价于 @Req() request ===> request.body
    async register(@Body() registerUser: RegisterUserDto) {
        console.log(registerUser);
        return await this.userService.register(registerUser);
    }

    @Get('register-captcha')
    async captcha(@Query('address') address: string) {
        const code = Math.random().toString().slice(2, 8);

        await this.redisService.set(`captcha_${address}`, code, 5 * 60);

        await this.emailService.sendMail({
            to: address,
            subject: '注册验证码',
            html: `<p>你的注册验证码是 ${code}</p>`,
        });
        return '发送成功';
    }
}
