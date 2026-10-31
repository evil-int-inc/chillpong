import type {
  Backend,
  GlobalPlayerView as GlobalPlayer,
  UserId,
} from "@/backend";
import { DeletePlayerError } from "@/backend";

export const PLAYERS_QUERY_KEY = ["players"] as const;

/** Shared player identities; tournament registrations keep their own numbers. */
export class PlayerService {
  list(actor: Backend): Promise<GlobalPlayer[]> {
    return actor.listPlayers();
  }

  create(actor: Backend, name: string, skill: number): Promise<GlobalPlayer> {
    return actor.createPlayer({ name, skillLevel: BigInt(skill) });
  }

  update(
    actor: Backend,
    playerId: bigint,
    name: string,
    skill: number,
  ): Promise<GlobalPlayer> {
    return actor.updatePlayer(playerId, { name, skillLevel: BigInt(skill) });
  }

  link(
    actor: Backend,
    playerId: bigint,
    userId: UserId,
  ): Promise<GlobalPlayer> {
    return actor.linkPlayerToUser(playerId, userId);
  }

  unlink(actor: Backend, playerId: bigint): Promise<GlobalPlayer> {
    return actor.unlinkPlayerFromUser(playerId);
  }

  async remove(actor: Backend, playerId: bigint): Promise<void> {
    const result = await actor.deletePlayer(playerId);
    if (result.__kind__ === "err") {
      throw new Error(
        result.err === DeletePlayerError.notFound
          ? "Player not found"
          : "Unauthorized: Only admins can perform this action",
      );
    }
  }
}

export const playerService = new PlayerService();
