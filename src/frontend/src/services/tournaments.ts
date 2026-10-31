import {
  type Backend,
  DeleteTournamentError,
  type Tournament,
  type TournamentInput,
} from "@/backend";

/** Tournament reads are public; the backend protects all mutations. */
export class TournamentService {
  list(actor: Backend): Promise<Tournament[]> {
    return actor.getTournaments();
  }

  get(actor: Backend, id: bigint): Promise<Tournament | null> {
    return actor.getTournament(id);
  }

  create(actor: Backend, input: TournamentInput): Promise<Tournament> {
    return actor.createTournament(input);
  }

  update(
    actor: Backend,
    id: bigint,
    input: TournamentInput,
  ): Promise<Tournament> {
    return actor.updateTournament(id, input);
  }

  async remove(actor: Backend, id: bigint): Promise<void> {
    const result = await actor.deleteTournament(id);
    if (result.__kind__ === "err") {
      throw new Error(
        result.err === DeleteTournamentError.notFound
          ? "Tournament not found"
          : "Unauthorized: Only admins can perform this action",
      );
    }
  }
}

export const tournamentService = new TournamentService();
