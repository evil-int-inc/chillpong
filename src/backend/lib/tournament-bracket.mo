import Array "mo:core/Array";
import Int "mo:core/Int";
import List "mo:core/List";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Order "mo:core/Order";
import Runtime "mo:core/Runtime";
import Set "mo:core/Set";
import T "../types/tournaments";

module {
  type SeedPair = { a : T.TournamentPlayerData; b : T.TournamentPlayerData; gap : Nat };

  public func initial(now : Int) : T.TournamentStateData {
    {
      elimination = #singleElimination; tableCount = 3; started = false;
      players = []; matches = []; history = [];
      nextRegistrationNumber = 1; nextMatchId = 1; nextActionId = 1; updatedAt = now;
    };
  };

  public func player(state : T.TournamentStateData, id : Nat) : T.TournamentPlayerData {
    state.players.find(func item = item.id == id) ?? Runtime.trap("Player not found");
  };

  public func matchById(state : T.TournamentStateData, id : Nat) : T.TournamentMatch {
    state.matches.find(func item = item.id == id) ?? Runtime.trap("Match not found");
  };

  func fifo(a : T.TournamentPlayerData, b : T.TournamentPlayerData) : Order.Order {
    switch (Int.compare(a.queuePriority, b.queuePriority)) {
      case (#equal) { Nat.compare(a.registrationNumber, b.registrationNumber) };
      case value { value };
    };
  };

  func pairPlayers(players : [T.TournamentPlayerData]) : [SeedPair] {
    let pairs = List.empty<SeedPair>();
    let remaining = List.empty<T.TournamentPlayerData>();
    for (level in Nat.rangeInclusive(1, 5)) {
      let group = players.filter(func item = item.skillLevel == level).sort(fifo);
      var index = 0;
      while (index + 1 < group.size()) {
        pairs.add({ a = group[index]; b = group[index + 1]; gap = 0 });
        index += 2;
      };
      if (index < group.size()) { remaining.add(group[index]) };
    };
    let unpaired = remaining.toArray().sort(func(a, b) = Nat.compare(a.skillLevel, b.skillLevel));
    var index = 0;
    while (index + 1 < unpaired.size()) {
      let a = unpaired[index];
      let b = unpaired[index + 1];
      pairs.add({ a; b; gap = Int.abs((b.skillLevel : Int) - a.skillLevel) });
      index += 2;
    };
    if (index != unpaired.size()) { Runtime.trap("Bracket pairing invariant failed") };
    pairs.toArray().sort(func(a, b) {
      let priorityA = Int.min(a.a.queuePriority, a.b.queuePriority);
      let priorityB = Int.min(b.a.queuePriority, b.b.queuePriority);
      switch (Int.compare(priorityA, priorityB)) {
        case (#equal) {
          switch (Nat.compare(a.gap, b.gap)) {
            case (#equal) { Nat.compare(Nat.min(a.a.registrationNumber, a.b.registrationNumber), Nat.min(b.a.registrationNumber, b.b.registrationNumber)) };
            case value { value };
          };
        };
        case value { value };
      };
    });
  };

  func emptyMatch(id : Nat, bracket : T.TournamentBracket, round : Nat, position : Nat, sourceA : T.MatchSource, sourceB : T.MatchSource) : T.TournamentMatch {
    {
      id; bracket; round; position; sourceA; sourceB;
      playerA = null; playerB = null; scoreA = null; scoreB = null;
      winnerId = null; loserId = null; status = #blocked; table = null;
      priority = 0; manualOverride = false;
    };
  };

  public func generate(state : T.TournamentStateData) : T.TournamentStateData {
    let active = state.players.filter(func item = not item.removed);
    if (active.size() < 2) { Runtime.trap("At least 2 active players are required") };
    if (active.size() > 4096) { Runtime.trap("At most 4096 active players are supported") };
    var size = 2;
    while (size < active.size()) { size *= 2 };
    let byeCount = Int.abs((size : Int) - active.size());
    let fair = active.sort(func(a, b) {
      switch (Nat.compare(a.skillLevel, b.skillLevel)) {
        case (#equal) { Nat.compare(a.registrationNumber, b.registrationNumber) };
        case value { value };
      };
    });
    let byePlayers = Array.tabulate(byeCount, func index = fair[index]);
    let byeIds = Set.empty<Nat>();
    for (item in byePlayers.values()) { byeIds.add(item.id) };
    let paired = pairPlayers(active.filter(func item = not byeIds.contains(item.id)));
    let matches = List.empty<T.TournamentMatch>();
    let rounds = List.empty<[Nat]>();
    let opening = List.empty<Nat>();
    var nextId = state.nextMatchId;
    var position = 1;
    for (pair in paired.values()) {
      matches.add(emptyMatch(nextId, #winners, 1, position, #player(pair.a.id), #player(pair.b.id)));
      opening.add(nextId); nextId += 1; position += 1;
    };
    for (item in byePlayers.values()) {
      matches.add(emptyMatch(nextId, #winners, 1, position, #player(item.id), #bye));
      opening.add(nextId); nextId += 1; position += 1;
    };
    var previous = opening.toArray();
    rounds.add(previous);
    var round = 2;
    while (previous.size() > 1) {
      let current = List.empty<Nat>();
      var index = 0;
      while (index + 1 < previous.size()) {
        matches.add(emptyMatch(nextId, #winners, round, index / 2 + 1, #winner(previous[index]), #winner(previous[index + 1])));
        current.add(nextId); nextId += 1; index += 2;
      };
      previous := current.toArray(); rounds.add(previous); round += 1;
    };
    let winnerFinal = previous[0];
    if (state.elimination == #doubleElimination) {
      let winnerRounds = rounds.toArray();
      var loserFinalSource : T.MatchSource = #loser(winnerFinal);
      if (winnerRounds.size() > 1) {
        let firstLoserRound = List.empty<Nat>();
        let firstWinners = winnerRounds[0];
        var index = 0;
        while (index + 1 < firstWinners.size()) {
          matches.add(emptyMatch(nextId, #losers, 1, index / 2 + 1, #loser(firstWinners[index]), #loser(firstWinners[index + 1])));
          firstLoserRound.add(nextId); nextId += 1; index += 2;
        };
        var loserPrevious = firstLoserRound.toArray();
        var winnerRound = 2;
        while (winnerRound <= winnerRounds.size()) {
          let incoming = winnerRounds[winnerRound - 1].reverse();
          let merged = List.empty<Nat>();
          var mergeIndex = 0;
          while (mergeIndex < incoming.size()) {
            matches.add(emptyMatch(nextId, #losers, 2 * winnerRound - 2, mergeIndex + 1, #winner(loserPrevious[mergeIndex]), #loser(incoming[mergeIndex])));
            merged.add(nextId); nextId += 1; mergeIndex += 1;
          };
          loserPrevious := merged.toArray();
          if (winnerRound < winnerRounds.size()) {
            let consolidated = List.empty<Nat>();
            var consolidateIndex = 0;
            while (consolidateIndex + 1 < loserPrevious.size()) {
              matches.add(emptyMatch(nextId, #losers, 2 * winnerRound - 1, consolidateIndex / 2 + 1, #winner(loserPrevious[consolidateIndex]), #winner(loserPrevious[consolidateIndex + 1])));
              consolidated.add(nextId); nextId += 1; consolidateIndex += 2;
            };
            loserPrevious := consolidated.toArray();
          };
          winnerRound += 1;
        };
        loserFinalSource := #winner(loserPrevious[0]);
      };
      matches.add(emptyMatch(nextId, #grandFinal, 1, 1, #winner(winnerFinal), loserFinalSource));
      nextId += 1;
      matches.add(emptyMatch(nextId, #resetFinal, 2, 1, #winner(winnerFinal), loserFinalSource));
      nextId += 1;
    };
    refresh({ state with started = true; matches = matches.toArray(); nextMatchId = nextId });
  };

  func alive(players : Map.Map<Nat, T.TournamentPlayerData>, id : ?Nat) : ?Nat {
    switch (id) {
      case (?value) {
        switch (players.get(value)) { case (?item) { if (item.removed) { null } else { ?value } }; case null { null } };
      };
      case null { null };
    };
  };

  func resolved(source : T.MatchSource, players : Map.Map<Nat, T.TournamentPlayerData>, matches : Map.Map<Nat, T.TournamentMatch>) : (Bool, ?Nat) {
    switch (source) {
      case (#bye) { (true, null) };
      case (#player(id)) { (true, alive(players, ?id)) };
      case (#winner(id)) {
        switch (matches.get(id)) {
          case (?item) { if (item.status == #completed or item.status == #bye or item.status == #cancelled) { (true, alive(players, item.winnerId)) } else { (false, null) } };
          case null { (false, null) };
        };
      };
      case (#loser(id)) {
        switch (matches.get(id)) {
          case (?item) { if (item.status == #completed or item.status == #bye or item.status == #cancelled) { (true, alive(players, item.loserId)) } else { (false, null) } };
          case null { (false, null) };
        };
      };
    };
  };

  public func refresh(state : T.TournamentStateData) : T.TournamentStateData {
    let players = Map.empty<Nat, T.TournamentPlayerData>();
    for (item in state.players.values()) { players.add(item.id, item) };
    let matches = Map.empty<Nat, T.TournamentMatch>();
    let ordered = List.empty<T.TournamentMatch>();
    var grandFinal : ?T.TournamentMatch = null;
    for (item in state.matches.values()) {
      let a = resolved(item.sourceA, players, matches);
      let b = resolved(item.sourceB, players, matches);
      var resetPending = false;
      var resetCancelled = false;
      if (item.bracket == #resetFinal) {
        switch (grandFinal) {
          case (?final) {
            if (final.status != #completed and final.status != #bye and final.status != #cancelled) {
              resetPending := true;
            } else {
              resetCancelled := final.status != #completed or final.playerA == null or final.winnerId != final.playerB;
            };
          };
          case null { resetPending := true };
        };
      };
      let updated : T.TournamentMatch = if (resetPending) {
        { item with status = #blocked; playerA = null; playerB = null; winnerId = null; loserId = null; scoreA = null; scoreB = null; table = null };
      } else if (resetCancelled) {
        { item with status = #cancelled; playerA = a.1; playerB = b.1; winnerId = null; loserId = null; scoreA = null; scoreB = null; table = null };
      } else if (item.status == #completed) {
        // A withdrawal or rename never rewrites a scored historical result.
        item;
      } else if (not a.0 or not b.0) {
        { item with status = #blocked; playerA = a.1; playerB = b.1; winnerId = null; loserId = null; scoreA = null; scoreB = null; table = null };
      } else {
        switch (a.1, b.1) {
          case (?playerA, ?playerB) {
            if (playerA == playerB) { Runtime.trap("A player cannot occupy both sides of a match") };
            { item with status = if (item.status == #playing) { #playing } else { #ready }; playerA = ?playerA; playerB = ?playerB; winnerId = null; loserId = null; scoreA = null; scoreB = null };
          };
          case (?playerA, null) {
            { item with status = #bye; playerA = ?playerA; playerB = null; winnerId = ?playerA; loserId = null; scoreA = null; scoreB = null };
          };
          case (null, ?playerB) {
            { item with status = #bye; playerA = null; playerB = ?playerB; winnerId = ?playerB; loserId = null; scoreA = null; scoreB = null };
          };
          case (null, null) {
            { item with status = #cancelled; playerA = null; playerB = null; winnerId = null; loserId = null; scoreA = null; scoreB = null; table = null };
          };
        };
      };
      matches.add(updated.id, updated); ordered.add(updated);
      if (updated.bracket == #grandFinal) { grandFinal := ?updated };
    };
    { state with matches = ordered.toArray() };
  };

  public func champion(state : T.TournamentStateData) : ?Nat {
    if (not state.started) { return null };
    if (state.elimination == #singleElimination) {
      let finals = state.matches.filter(func item = item.bracket == #winners).sort(func(a, b) {
        switch (Nat.compare(b.round, a.round)) { case (#equal) { Nat.compare(b.position, a.position) }; case order { order } };
      });
      if (finals.size() == 0) { return null };
      let final = finals[0];
      if (final.status == #completed or final.status == #bye) { final.winnerId } else { null };
    } else {
      let grand = state.matches.find(func item = item.bracket == #grandFinal);
      let reset = state.matches.find(func item = item.bracket == #resetFinal);
      switch (grand) {
        case (?final) {
          if (final.status != #completed and final.status != #bye) { return null };
          let needsReset = final.status == #completed and final.playerA != null and final.winnerId == final.playerB;
          if (not needsReset) { return final.winnerId };
          switch (reset) { case (?item) { if (item.status == #completed or item.status == #bye) { item.winnerId } else { null } }; case null { null } };
        };
        case null { null };
      };
    };
  };

  public func view(tournamentId : Nat, original : T.TournamentStateData) : T.TournamentState {
    let state = refresh(original);
    let winner = champion(state);
    let playerIndex = Map.empty<Nat, T.TournamentPlayerData>();
    let losses = Map.empty<Nat, Nat>();
    let current = Map.empty<Nat, T.TournamentMatch>();
    let seeds = Map.empty<Nat, Nat>();
    let participated = Set.empty<Nat>();
    for (item in state.players.values()) { playerIndex.add(item.id, item) };
    func assignCurrent(id : ?Nat, item : T.TournamentMatch) {
      switch (id) {
        case (?value) {
          switch (current.get(value)) {
            case (?existing) {
              if (item.status == #playing or (item.status == #ready and existing.status != #playing)) { current.add(value, item) };
            };
            case null { current.add(value, item) };
          };
        };
        case null {};
      };
    };
    for (item in state.matches.values()) {
      if (item.bracket == #winners and item.round == 1) {
        switch (item.sourceA) { case (#player(id)) { seeds.add(id, Int.abs((item.position * 2 : Int) - 1)) }; case _ {} };
        switch (item.sourceB) { case (#player(id)) { seeds.add(id, item.position * 2) }; case _ {} };
      };
      if (item.status == #completed) {
        switch (item.loserId) { case (?id) { losses.add(id, (losses.get(id) ?? 0) + 1) }; case null {} };
        switch (item.playerA) { case (?id) { participated.add(id) }; case null {} };
        switch (item.playerB) { case (?id) { participated.add(id) }; case null {} };
      };
      if (item.status == #ready or item.status == #playing or item.status == #blocked) {
        assignCurrent(item.playerA, item); assignCurrent(item.playerB, item);
      };
    };
    let publicPlayers : [T.TournamentPlayer] = state.players.map(func item {
      let count = losses.get(item.id) ?? 0;
      let activeMatch = current.get(item.id);
      let eliminated = count >= (if (state.elimination == #doubleElimination) { 2 } else { 1 });
      let status : T.TournamentPlayerStatus = if (item.removed) { #removed } else if (winner == ?item.id) { #champion } else if (eliminated) { #eliminated } else {
        switch (activeMatch) {
          case (?matchItem) { switch (matchItem.status) { case (#playing) { #playing }; case (#ready) { #ready }; case _ { #waiting } } };
          case null { if (participated.contains(item.id)) { #advanced } else { #waiting } };
        };
      };
      {
        id = item.id; name = item.name; skillLevel = item.skillLevel;
        registrationNumber = item.registrationNumber; registeredAt = item.registeredAt;
        seed = seeds.get(item.id); status; losses = count;
        currentMatchId = switch (activeMatch) { case (?matchItem) { ?matchItem.id }; case null { null } };
        table = switch (activeMatch) { case (?matchItem) { matchItem.table }; case null { null } };
      };
    });
    let eligible = state.matches.filter(func item = item.status == #ready).sort(func(a, b) {
      let a1 = playerIndex.get(a.playerA ?? 0) ?? Runtime.trap("Match participant missing");
      let a2 = playerIndex.get(a.playerB ?? 0) ?? Runtime.trap("Match participant missing");
      let b1 = playerIndex.get(b.playerA ?? 0) ?? Runtime.trap("Match participant missing");
      let b2 = playerIndex.get(b.playerB ?? 0) ?? Runtime.trap("Match participant missing");
      let priorityA = Int.min(a.priority, Int.min(a1.queuePriority, a2.queuePriority));
      let priorityB = Int.min(b.priority, Int.min(b1.queuePriority, b2.queuePriority));
      switch (Int.compare(priorityA, priorityB)) {
        case (#equal) {
          let gapA = Int.abs((a1.skillLevel : Int) - a2.skillLevel);
          let gapB = Int.abs((b1.skillLevel : Int) - b2.skillLevel);
          switch (Nat.compare(gapA, gapB)) {
            case (#equal) {
              switch (Nat.compare(Nat.min(a1.registrationNumber, a2.registrationNumber), Nat.min(b1.registrationNumber, b2.registrationNumber))) {
                case (#equal) { Nat.compare(a.id, b.id) };
                case value { value };
              };
            };
            case value { value };
          };
        };
        case value { value };
      };
    });
    let waiting = publicPlayers.filter(func item = (item.status == #waiting or item.status == #ready or item.status == #advanced) and item.table == null).sort(func(a, b) {
      let rawA = playerIndex.get(a.id) ?? Runtime.trap("Player missing");
      let rawB = playerIndex.get(b.id) ?? Runtime.trap("Player missing");
      fifo(rawA, rawB);
    });
    let tables : [T.TournamentTable] = Array.tabulate(state.tableCount, func index {
      let number = index + 1;
      let active = state.matches.find(func item = item.table == ?number and (item.status == #ready or item.status == #playing));
      switch (active) {
        case (?item) { { number; status = if (item.status == #playing) { #playing } else { #waiting }; matchId = ?item.id } };
        case null {
          let finished = state.matches.reverse().find(func item = item.table == ?number and (item.status == #completed or item.status == #bye));
          { number; status = if (finished == null) { #available } else { #finished }; matchId = switch (finished) { case (?item) { ?item.id }; case null { null } } };
        };
      };
    });
    {
      tournamentId; elimination = state.elimination; tableCount = state.tableCount; started = state.started;
      players = publicPlayers; matches = state.matches;
      waitingQueue = waiting.map(func item = item.id);
      nextMatches = eligible.map(func item = item.id);
      tables; championId = winner; history = state.history.map(func item = item.action);
      canUndo = state.history.size() > 0; updatedAt = state.updatedAt;
    };
  };
};
