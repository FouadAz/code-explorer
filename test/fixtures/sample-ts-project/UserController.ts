import { User, UserService } from './UserService';

export class UserController {
  private userService: UserService;

  constructor(userService: UserService) {
    this.userService = userService;
  }

  async handleGetUser(id: string): Promise<User | null> {
    return this.userService.getUser(id);
  }

  async handleCreateUser(userData: Omit<User, 'id'>): Promise<User> {
    const user: User = {
      id: this.generateId(),
      ...userData,
    };
    return this.userService.createUser(user);
  }

  async handleDeleteUser(id: string): Promise<boolean> {
    return this.userService.deleteUser(id);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}
