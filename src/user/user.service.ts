import {
    Injectable,
    Logger,
    Inject,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { md5 } from '../utils/md5';
import { Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import { User } from './entities/user.entity';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class UserService {
    // 错误日志记录
    private logger = new Logger();

    @InjectRepository(User)
    private userRepository: Repository<User>;

    @Inject(RedisService)
    private redisService: RedisService;

    async register(user: RegisterUserDto) {
        // 根据用户email从redis中获取验证码
        const captcha = await this.redisService.get(`captcha_${user.email}`);
        console.log(`captcha_${user.email}`);
        console.log(await this.redisService.get('*'));

        if (!captcha) {
            throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
        }

        if (user.captcha !== captcha) {
            throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
        }

        const foundUser = await this.userRepository.findOneBy({
            username: user.username,
        });
        // 数据库存在该用户名
        if (foundUser) {
            throw new HttpException('用户已存在', HttpStatus.BAD_REQUEST);
        }

        const newUser = new User();
        newUser.username = user.username;
        newUser.password = md5(user.password);
        newUser.email = user.email;
        newUser.nickName = user.nickName;

        try {
            await this.userRepository.save(newUser);
            return '注册成功';
        } catch (e) {
            this.logger.error(e, UserService);
            return '注册失败';
        }
    }
}
