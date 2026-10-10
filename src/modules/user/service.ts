import { db as postgresDb } from "@/db/postgres";
import { NotFoundError } from "@/utils/errors";

/**
 * User service - handles all business logic for user operations
 */
export abstract class UserService {
  /**
   * Find a user by username
   */
  static async findByUsername(username: string) {
    const data = await postgresDb.query.user.findFirst({
      where: { username },
    });

    if (!data) {
      throw new NotFoundError("User not found");
    }

    return {
      id: data.id,
      image: data.image,
      name: data.name,
      username: data.username,
      games: [],
    };
  }

  /**
   * Find a user by ID
   */
  static async findById(userId: string) {
    const userData = await postgresDb.query.user.findFirst({
      where: { id: userId },
    });

    if (!userData) {
      throw new NotFoundError("User not found");
    }

    return {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      name: userData.name,
      image: userData.image,
    };
  }
}
