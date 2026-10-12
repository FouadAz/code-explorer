import { UserService } from './UserService';
import { UserController } from './UserController';

async function main() {
  console.log('Starting application...');

  const userService = new UserService();
  const userController = new UserController(userService);

  // Create a test user
  const user = await userController.handleCreateUser({
    name: 'John Doe',
    email: 'john@example.com',
  });

  console.log('Created user:', user);

  // Retrieve the user
  const retrieved = await userController.handleGetUser(user.id);
  console.log('Retrieved user:', retrieved);
}

main().catch(console.error);
