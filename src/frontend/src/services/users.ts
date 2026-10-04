import type { Backend, User, UserId, UserInput } from "@/backend";

/** Public member directory and administrator-managed profiles. */
export class UserService {
  list(actor: Backend): Promise<User[]> {
    return actor.listUsers();
  }

  get(actor: Backend, userId: UserId): Promise<User | null> {
    return actor.getUser(userId);
  }

  getByUsername(actor: Backend, username: string): Promise<User | null> {
    return actor.getUserByUsername(username);
  }

  create(actor: Backend, userId: UserId, input: UserInput): Promise<User> {
    return actor.createUser(userId, input);
  }

  update(actor: Backend, userId: UserId, input: UserInput): Promise<User> {
    return actor.updateUser(userId, input);
  }
}

export const userService = new UserService();
