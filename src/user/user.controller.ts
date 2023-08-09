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
    UnauthorizedException,
    ParseIntPipe,
    BadRequestException,
    DefaultValuePipe,
    HttpStatus,
} from '@nestjs/common';
import { UserService } from './user.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/udpate-user.dto';
import { EmailService } from '../email/email.service';
import { RedisService } from 'src/redis/redis.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RequireLogin, UserInfo } from '../custom.decorator';
import { UserDetailVo } from './vo/user-info.vo';
import { generateParseIntPipe } from '../utils/parse';
import {
    ApiBearerAuth,
    ApiBody,
    ApiProperty,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

@ApiTags('用户管理模块')
@Controller('user')
export class UserController {
    constructor(private readonly userService: UserService) {}

    @Inject(EmailService)
    private emailService: EmailService;

    @Inject(RedisService)
    private redisService: RedisService;

    @Inject(JwtService)
    private jwtService: JwtService;

    @Inject(ConfigService)
    private configService: ConfigService;

    @Get('init-data')
    async initData() {
        await this.userService.initData();
        return 'done';
    }

    @ApiBody({ type: RegisterUserDto })
    @ApiResponse({
        status: HttpStatus.BAD_REQUEST,
        description: '验证码已失效/验证码不正确/用户已存在',
        type: String,
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '注册成功/失败',
        type: String,
    })
    @Post('register')
    // 将请求体注入到register方法的参数register中，等价于 @Req() request ===> request.body
    async register(@Body() registerUser: RegisterUserDto) {
        console.log(registerUser);
        return await this.userService.register(registerUser);
    }

    @ApiQuery({
        name: 'address',
        type: String,
        description: '邮箱地址',
        required: true,
        example: 'xxx@xx.com',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '发送成功',
        type: String,
    })
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

    @Post('login')
    async userLogin(@Body() loginUser: LoginUserDto) {
        const vo = await this.userService.login(loginUser, false);

        vo.accessToken = this.jwtService.sign(
            {
                userId: vo.userInfo.id,
                username: vo.userInfo.username,
                roles: vo.userInfo.roles,
                permissions: vo.userInfo.permissions,
            },
            {
                expiresIn:
                    this.configService.get('jwt_access_token_expires_time') ||
                    '30m',
            },
        );

        vo.refreshToken = this.jwtService.sign(
            {
                userId: vo.userInfo.id,
            },
            {
                expiresIn:
                    this.configService.get('jwt_refresh_token_expres_time') ||
                    '7d',
            },
        );

        return vo;
    }

    @Post('admin/login')
    async adminLogin(@Body() loginUser: LoginUserDto) {
        const vo = await this.userService.login(loginUser, true);
        return vo;
    }

    @Get('refresh')
    async refresh(@Query('refreshToken') refreshToken: string) {
        try {
            const data = this.jwtService.verify(refreshToken);

            const user = await this.userService.findUserById(
                data.userId,
                false,
            );

            const access_token = this.jwtService.sign(
                {
                    userId: user.id,
                    username: user.username,
                    roles: user.roles,
                    permissions: user.permissions,
                },
                {
                    expiresIn:
                        this.configService.get(
                            'jwt_access_token_expires_time',
                        ) || '30m',
                },
            );

            const refresh_token = this.jwtService.sign(
                {
                    userId: user.id,
                },
                {
                    expiresIn:
                        this.configService.get(
                            'jwt_refresh_token_expres_time',
                        ) || '7d',
                },
            );

            return {
                access_token,
                refresh_token,
            };
        } catch (e) {
            throw new UnauthorizedException('token 已失效，请重新登录');
        }
    }

    @Get('admin/refresh')
    async adminRefresh(@Query('refreshToken') refreshToken: string) {
        try {
            const data = this.jwtService.verify(refreshToken);

            const user = await this.userService.findUserById(data.userId, true);

            const access_token = this.jwtService.sign(
                {
                    userId: user.id,
                    username: user.username,
                    roles: user.roles,
                    permissions: user.permissions,
                },
                {
                    expiresIn:
                        this.configService.get(
                            'jwt_access_token_expires_time',
                        ) || '30m',
                },
            );

            const refresh_token = this.jwtService.sign(
                {
                    userId: user.id,
                },
                {
                    expiresIn:
                        this.configService.get(
                            'jwt_refresh_token_expres_time',
                        ) || '7d',
                },
            );

            return {
                access_token,
                refresh_token,
            };
        } catch (e) {
            throw new UnauthorizedException('token 已失效，请重新登录');
        }
    }

    @Get('info')
    @RequireLogin()
    async info(@UserInfo('userId') userId: number) {
        const user = await this.userService.findUserDetailById(userId);
        const vo = new UserDetailVo();
        vo.id = user.id;
        vo.email = user.email;
        vo.username = user.username;
        vo.headPic = user.headPic;
        vo.phoneNumber = user.phoneNumber;
        vo.nickName = user.nickName;
        vo.createTime = user.createTime;
        vo.isFrozen = user.isFrozen;

        return vo;
    }

    @Post(['update_password', 'admin/update_password'])
    @RequireLogin()
    async updatePassword(
        @UserInfo('userId') userId: number,
        @Body() passwordDto: UpdateUserPasswordDto,
    ) {
        return await this.userService.updatePassword(userId, passwordDto);
    }

    @Get('update_password/captcha')
    async updatePasswordCaptcha(@Query('address') address: string) {
        const code = Math.random().toString().slice(2, 8);

        await this.redisService.set(
            `update_password_captcha_${address}`,
            code,
            10 * 60,
        );

        await this.emailService.sendMail({
            to: address,
            subject: '更改密码验证码',
            html: `<p>你的更改密码验证码是 ${code}</p>`,
        });
        return '发送成功';
    }

    // 修改个人信息
    @Post(['update', 'admin/update'])
    @RequireLogin()
    async update(
        @UserInfo('userId') userId: number,
        @Body() updateUserDto: UpdateUserDto,
    ) {
        return await this.userService.update(userId, updateUserDto);
    }

    // 冻结用户
    @Get('freeze')
    async freeze(@Query('id') userId: number) {
        await this.userService.freezeUserById(userId);
        return 'success';
    }

    // 用户列表
    @Get('list')
    async list(
        @Query(
            'pageNo',
            new DefaultValuePipe(1),
            generateParseIntPipe('pageNo'),
        )
        pageNo: number,
        @Query(
            'pageSize',
            new DefaultValuePipe(2),
            generateParseIntPipe('pageSize'),
        )
        pageSize: number,
        @Query('username') username: string,
        @Query('nickName') nickName: string,
        @Query('email') email: string,
    ) {
        return await this.userService.findUsers(
            username,
            nickName,
            email,
            pageNo,
            pageSize,
        );
    }
}
