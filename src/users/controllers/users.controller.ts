import {Body, Controller, Delete, Get, Param, Post, Put, Req, UnauthorizedException} from '@nestjs/common';
import {CreatedUserDto} from '../dto/users.dto';
import {UsersService} from '../services/users.service';
import {HttpException} from '@nestjs/common/exceptions';
import {ValidationPipe} from '@nestjs/common/pipes';
import {UseGuards, UsePipes} from '@nestjs/common/decorators';
import {AuthService} from '../../auth/services/auth.service';
import {JwtAuthGuard} from "../../auth/guards/jwt-auth.guard";
import {LoginDto} from '../dto/login.dto';
import {Role} from '../role.enum';
import {UpdatedUsersDto} from '../dto/usersUpdate.dto';
import {uuidRegex} from "../variables.const";
import {RedisService} from "../../redis/service/redis.service";
import * as bcrypt from 'bcrypt';

@Controller('users')
export class UsersController {

    constructor(private usersService: UsersService, private authService: AuthService, private readonly redisService: RedisService) {}

    @UseGuards(JwtAuthGuard)
    @Get("/")
    GetAll() {
        return this.usersService.GetAll();
    }

    @UseGuards(JwtAuthGuard)
    @Get('/me')
    GetMe(@Req() req) {
        return this.usersService.FindOneId(req.user.id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('/:id')
    async GetId(@Param('id') id: string): Promise<{}> {
        if (!uuidRegex.test(id)){
            throw new HttpException('ID Invalide', 400);
        }
        let user = await this.usersService.FindOneId(id);
        if (!user) throw new HttpException("L'utilisateur n'a pas été trouvé", 404);
        return user;
    }

    @UsePipes(ValidationPipe)
    @Post('/auth/sign-up')
    async SignUp(@Body() body: CreatedUserDto): Promise<{}> {
        if (await this.usersService.checkUnknownUser(body)) throw new HttpException('L\'utilisateur existe déjà', 409);
        body.password = await hashPassword(body.password);
        return this.usersService.Create(body);
    }

    @UsePipes(ValidationPipe)
    @Post('/auth/login')
    async Login(@Body() body: LoginDto) {
        let user = await this.usersService.FindOneEmail(body.email);
        if (!user) throw new HttpException("Aucun email associé à ce compte", 401);
        if (!await comparePassword(body.password, user.password)) throw new HttpException('Mot de passe incorrect', 401);
        return this.authService.Login(user);
    }

    @UseGuards(JwtAuthGuard)
    @Delete('/:id')
    async Delete(@Param('id') id: string, @Req() req): Promise<{}> {
        const me = await this.usersService.FindOneId(req.user.id);
        if (!me) throw new UnauthorizedException();
        if (Role.Admin != me.role) throw new HttpException('Vous n\'êtes pas administrateur', 403);
        if (!uuidRegex.test(id)) throw new HttpException('ID Invalide', 400);
        return this.usersService.Delete(id);
    }

    @UseGuards(JwtAuthGuard)
    @UsePipes(ValidationPipe)
    @Put('/:id')
    async Update(@Param('id') id: string, @Req() req, @Body() body: UpdatedUsersDto): Promise<{}> {
        const me = await this.usersService.FindOneId(req.user.id);
        if (!me) throw new UnauthorizedException();
        if (Role.Admin != me.role && me.id != id) throw new HttpException('Tu n\'es pas administrateur', 403);
        if (body.role === "Admin" && me.role !== Role.Admin) throw new HttpException('Tu n\'es pas administrateur pour réaliser cette action', 403);
        if (!uuidRegex.test(id)) throw new HttpException('Invalid id', 400);
        if (await this.usersService.checkUnknownUser(body)) throw new HttpException('L\'utilisateur existe déjà', 409);
        if (body.password) body.password = await hashPassword(body.password);
        await this.usersService.Update(id, body);
        let user = await this.usersService.FindOneId(id);
        if (!user) throw new HttpException('L\'utilisateur n\'existe pas', 404);
        return user;
    }
}

async function hashPassword(plaintextPassword: string) {
    return await bcrypt.hash(plaintextPassword, 10);
}

async function comparePassword(plaintextPassword: string, hash: string) {
    return await bcrypt.compare(plaintextPassword, hash);
}
