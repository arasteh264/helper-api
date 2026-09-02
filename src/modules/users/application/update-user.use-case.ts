import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { UpdateUserDto } from "./dto/update-user.dto";
import * as userRepository from "../domain/repositories/user.repository";
import { USER_REPOSITORY } from "../domain/repositories/user.repository.token";
import { User } from "../domain/entities/user.entity"; 

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: userRepository.UserRepository,
  ) {}

  async execute(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.updateProfile(dto.name, dto.phone);

    await this.userRepository.update(user);

    return user;
  }
}