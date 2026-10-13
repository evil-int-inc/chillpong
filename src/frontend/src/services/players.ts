import type { Backend, GlobalPlayer, UserId } from "@/backend";

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
}

export const playerService = new PlayerService();
