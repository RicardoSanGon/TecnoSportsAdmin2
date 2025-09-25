/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from 'src/api/users/dto/create-user.dto';
import { User } from 'src/api/users/entities/user.entity';
import { SupabaseService } from 'src/supabase/supabase.service';
import { Repository } from 'typeorm';

@Injectable()
export class AuthService {
  constructor(
    private supabaseService: SupabaseService,
    @InjectRepository(User) private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async signUp(createUser: CreateUserDto) {
    const { email, password, name } = createUser;

    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const { data: authData, error: authError } = await this.supabaseService
      .getClient()
      .auth.signUp({
        email,
        password,
      });

    if (authError) {
      if (authError.message.includes('User already registered')) {
        throw new ConflictException(
          'User with this email already exists in our authentication provider.',
        );
      }
      throw new Error(authError.message);
    }

    if (authData.user) {
      try {
        const newUser = this.userRepository.create({
          authUserId: authData.user.id, // Conectar con Supabase Auth
          email,
          name,
          roleId: 3, // Asignar rol por defecto explícitamente
        });

        // TypeORM usará tu conexión directa a PostgreSQL, no Supabase
        const savedUser = await this.userRepository.save(newUser);

        return {
          auth: authData,
          profile: savedUser,
        };
      } catch (dbError) {
        // Si falla crear en la BD, eliminar el usuario de auth
        await this.supabaseService
          .getClient()
          .auth.admin.deleteUser(authData.user.id);
        throw new Error(`Error creating user profile: ${dbError.message}`);
      }
    }

    return authData;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      throw new UnauthorizedException(error.message);
    }

    return data;
  }

  async login(email: string, password: string) {
    // Primero autenticar con Supabase
    const { data: authData, error: authError } = await this.supabaseService
      .getClient()
      .auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    if (!authData.user) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    // Obtener el perfil del usuario con el rol
    const userProfile = await this.getUserProfile(authData.user.id);

    // Verificar que el usuario tenga rol de Administrador (ID 2)
    if (userProfile.roleId !== 2) {
      // Usuario válido pero sin permisos de admin
      const payload = {
        sub: authData.user.id,
        email: userProfile.email,
        name: userProfile.name,
        roleId: userProfile.roleId,
      };

      const token = this.jwtService.sign(payload);

      return {
        access_token: token,
        user: {
          id: userProfile.id,
          email: userProfile.email,
          name: userProfile.name,
          roleId: userProfile.roleId,
        },
        requires_admin: true, // Indica que necesita permisos de admin
      };
    }

    // Generar JWT token
    const payload = {
      sub: authData.user.id,
      email: userProfile.email,
      name: userProfile.name,
      roleId: userProfile.roleId,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: userProfile.id,
        email: userProfile.email,
        name: userProfile.name,
        roleId: userProfile.roleId,
      },
    };
  }

  async signOut() {
    const { error } = await this.supabaseService.getClient().auth.signOut();

    if (error) {
      throw new Error(error.message);
    }

    return { message: 'Logged out successfully' };
  }

  async getUserProfile(authUserId: string) {
    // Usar TypeORM para consultar, no Supabase
    const user = await this.userRepository.findOne({
      where: { authUserId },
    });

    if (!user) {
      throw new Error('User profile not found');
    }

    return user;
  }
}
