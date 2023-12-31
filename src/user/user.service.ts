import {
    Injectable,
    Logger,
    Inject,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { md5 } from '../utils/md5';
import { Like, Repository } from 'typeorm';
import { RegisterUserDto } from './dto/register-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/udpate-user.dto';
import { User } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { RedisService } from '../redis/redis.service';
import { LoginUserVo } from './vo/login-user.vo';

@Injectable()
export class UserService {
    // 错误日志记录
    private logger = new Logger();

    @InjectRepository(User)
    private userRepository: Repository<User>;
    @InjectRepository(Role)
    private roleRepository: Repository<User>;
    @InjectRepository(Permission)
    private permissionRepository: Repository<User>;

    @Inject(RedisService)
    private redisService: RedisService;

    // 初始化数据，生产环境导入sql
    async initData() {
        // 管理员，有 ccc 和 ddd 接口访问权限
        const user1 = new User();
        user1.username = 'zhangsan';
        user1.password = md5('111111');
        user1.email = 'xxx@xx.com';
        user1.isAdmin = true;
        user1.nickName = '张三';
        user1.phoneNumber = '13233323333';

        // 普通用户，只有 ccc 接口的访问权限
        const user2 = new User();
        user2.username = 'lisi';
        user2.password = md5('222222');
        user2.email = 'yy@yy.com';
        user2.nickName = '李四';

        const role1 = new Role();
        role1.name = '管理员';

        const role2 = new Role();
        role2.name = '普通用户';

        const permission1 = new Permission();
        permission1.code = 'ccc';
        permission1.description = '访问 ccc 接口';

        const permission2 = new Permission();
        permission2.code = 'ddd';
        permission2.description = '访问 ddd 接口';

        user1.roles = [role1];
        user2.roles = [role2];

        role1.permissions = [permission1, permission2];
        role2.permissions = [permission1];

        await this.permissionRepository.save([permission1, permission2]);
        await this.roleRepository.save([role1, role2]);
        await this.userRepository.save([user1, user2]);
    }

    // 注册
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

    // 用户登录
    async login(loginUserDto: LoginUserDto, isAdmin: boolean) {
        const user = await this.userRepository.findOne({
            where: {
                username: loginUserDto.username,
                isAdmin,
            },
            relations: ['roles', 'roles.permissions'],
        });
        console.log(user);

        if (!user) {
            throw new HttpException('用户不存在', HttpStatus.BAD_REQUEST);
        }

        if (user.password !== md5(loginUserDto.password)) {
            throw new HttpException('密码错误', HttpStatus.BAD_REQUEST);
        }

        const vo = new LoginUserVo();
        vo.userInfo = {
            id: user.id,
            username: user.username,
            nickName: user.nickName,
            email: user.email,
            phoneNumber: user.phoneNumber,
            headPic: user.headPic,
            createTime: user.createTime.getTime(),
            isFrozen: user.isFrozen,
            isAdmin: user.isAdmin,
            roles: user.roles.map((item) => item.name),
            permissions: user.roles.reduce((arr, item) => {
                item.permissions.forEach((permission) => {
                    if (arr.indexOf(permission) === -1) {
                        arr.push(permission);
                    }
                });
                return arr;
            }, []),
        };

        return vo;
    }

    async findUserById(userId: number, isAdmin: boolean) {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
                isAdmin,
            },
            relations: ['roles', 'roles.permissions'],
        });

        return {
            id: user.id,
            username: user.username,
            isAdmin: user.isAdmin,
            roles: user.roles.map((item) => item.name),
            permissions: user.roles.reduce((arr, item) => {
                item.permissions.forEach((permission) => {
                    if (arr.indexOf(permission) === -1) {
                        arr.push(permission);
                    }
                });
                return arr;
            }, []),
        };
    }

    // 详情
    async findUserDetailById(userId: number) {
        const user = await this.userRepository.findOne({
            where: {
                id: userId,
            },
        });

        return user;
    }
    async updatePassword(userId: number, passwordDto: UpdateUserPasswordDto) {
        // 先查询 redis 中有相对应的验证码
        const captcha = await this.redisService.get(
            `update_password_captcha_${passwordDto.email}`,
        );

        if (!captcha) {
            throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
        }

        if (passwordDto.captcha !== captcha) {
            throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
        }

        const foundUser = await this.userRepository.findOneBy({
            id: userId,
        });

        foundUser.password = md5(passwordDto.password);

        try {
            await this.userRepository.save(foundUser);
            return '密码修改成功';
        } catch (e) {
            this.logger.error(e, UserService);
            return '密码修改成功';
        }
    }

    async update(userId: number, updateUserDto: UpdateUserDto) {
        const captcha = await this.redisService.get(
            `update_user_captcha_${updateUserDto.email}`,
        );

        if (!captcha) {
            throw new HttpException('验证码已失效', HttpStatus.BAD_REQUEST);
        }

        if (updateUserDto.captcha !== captcha) {
            throw new HttpException('验证码不正确', HttpStatus.BAD_REQUEST);
        }

        const foundUser = await this.userRepository.findOneBy({
            id: userId,
        });

        if (updateUserDto.nickName) {
            foundUser.nickName = updateUserDto.nickName;
        }
        if (updateUserDto.headPic) {
            foundUser.headPic = updateUserDto.headPic;
        }

        try {
            await this.userRepository.save(foundUser);
            return '用户信息修改成功';
        } catch (e) {
            this.logger.error(e, UserService);
            return '用户信息修改成功';
        }
    }

    async freezeUserById(id: number) {
        const user = await this.userRepository.findOneBy({
            id,
        });

        user.isFrozen = true;

        await this.userRepository.save(user);
    }

    // 分页查询用户列表
    async findUsersByPage(pageNo: number, pageSize: number) {
        const skipCount = (pageNo - 1) * pageSize;

        const [users, totalCount] = await this.userRepository.findAndCount({
            select: [
                'id',
                'username',
                'nickName',
                'email',
                'phoneNumber',
                'isFrozen',
                'headPic',
                'createTime',
            ],
            skip: skipCount, // 跳过的数量
            take: pageSize,
        });

        return {
            users,
            totalCount,
        };
    }

    // 查询
    async findUsers(
        username: string,
        nickName: string,
        email: string,
        pageNo: number,
        pageSize: number,
    ) {
        const skipCount = (pageNo - 1) * pageSize;

        const condition: Record<string, any> = {};

        if (username) {
            condition.username = Like(`%${username}%`); // 模糊匹配
        }
        if (nickName) {
            condition.nickName = Like(`%${nickName}%`);
        }
        if (email) {
            condition.email = Like(`%${email}%`);
        }

        const [users, totalCount] = await this.userRepository.findAndCount({
            select: [
                'id',
                'username',
                'nickName',
                'email',
                'phoneNumber',
                'isFrozen',
                'headPic',
                'createTime',
            ],
            skip: skipCount,
            take: pageSize,
            where: condition,
        });

        return {
            users,
            totalCount,
        };
    }
}
