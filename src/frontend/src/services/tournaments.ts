import type { Backend, Tournament, TournamentInput } from "@/backend";

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
}

export const tournamentService = new TournamentService();
