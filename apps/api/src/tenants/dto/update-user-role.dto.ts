import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class UpdateUserRoleDto {
  @ApiProperty({
    description: 'New role for the user',
    example: 'user',
    enum: ['admin', 'user'],
  })
  @IsString({ message: 'Role must be a string' })
  @IsNotEmpty({ message: 'Role is required' })
  @IsIn(['admin', 'user'], { message: 'Role must be either "admin" or "user"' })
  role: 'admin' | 'user';
}
