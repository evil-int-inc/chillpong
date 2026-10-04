import { type Backend, ExternalBlob } from "@/backend";
import type { User, UserId } from "@/types";

/** Input for saving a channel profile. */
export interface SaveProfileInput {
  displayName: string;
  username: string;
  avatar: ExternalBlob | null;
  removeAvatar: boolean;
  bio: string | null;
}

/** Backend operations for channels and profiles. */
export class UserService {
  /** Fetches a channel by its principal id. */
  getChannel(actor: Backend, userId: UserId): Promise<User | null> {
    return actor.getChannel(userId);
  }

  /** Fetches a channel by its unique username. */
  getChannelByUsername(actor: Backend, username: string): Promise<User | null> {
    return actor.getChannelByUsername(username);
  }

  /** Saves the caller's channel profile. */
  saveProfile(actor: Backend, input: SaveProfileInput): Promise<User> {
    return actor.saveProfile(
      input.displayName,
      input.username,
      input.avatar,
      input.removeAvatar,
      input.bio,
    );
  }

  /** Wraps a selected avatar so generated bindings upload it to object storage. */
  async createAvatar(file: File): Promise<ExternalBlob> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return ExternalBlob.fromBytes(bytes, file.type, file.name);
  }
}

export const userService = new UserService();
