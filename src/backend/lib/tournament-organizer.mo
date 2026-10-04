import Array "mo:core/Array";
import Char "mo:core/Char";
import Int "mo:core/Int";
import List "mo:core/List";
import Nat "mo:core/Nat";
import Runtime "mo:core/Runtime";
import Set "mo:core/Set";
import Text "mo:core/Text";
import B "tournament-bracket";
import T "../types/tournaments";

module {
  func nameAndSkill(name : Text, skillLevel : Nat) : Text {
    let value = name.trim(#predicate(Char.isWhitespace));
    if (value.size() == 0 or value.size() > 80) { Runtime.trap("Player name must be between 1 and 80 characters") };
    if (skillLevel < 1 or skillLevel > 5) { Runtime.trap("Skill level must be between 1 and 5") };
    value;
  };

  func clear(item : T.TournamentMatch) : T.TournamentMatch {
    { item with status = #blocked; playerA = null; playerB = null; winnerId = null; loserId = null; scoreA = null; scoreB = null; table = null };
  };

  func sourceDepends(source : T.MatchSource, ids : Set.Set<Nat>) : Bool {
    switch (source) { case (#winner(id)) { ids.contains(id) }; case (#loser(id)) { ids.contains(id) }; case _ { false } };
  };

  func affected(state : T.TournamentStateData, roots : [Nat]) : Set.Set<Nat> {
    let ids = Set.empty<Nat>();
    for (id in roots.values()) { ids.add(id) };
    var grandAffected = false;
    for (item in state.matches.values()) {
      if (sourceDepends(item.sourceA, ids) or sourceDepends(item.sourceB, ids) or (item.bracket == #resetFinal and grandAffected)) { ids.add(item.id) };
      if (item.bracket == #grandFinal and ids.contains(item.id)) { grandAffected := true };
    };
    ids;
  };

  // Structural overrides never rewrite a scored or active dependent match.
  func structural(state : T.TournamentStateData, roots : [Nat]) : T.TournamentStateData {
    let ids = affected(state, roots);
    for (item in state.matches.values()) {
      if (ids.contains(item.id) and (item.status == #completed or item.status == #playing)) {
        Runtime.trap("Reset completed or playing dependent matches before changing the bracket");
      };
    };
    { state with matches = state.matches.map(func item = if (ids.contains(item.id)) { clear(item) } else { item }) };
  };

  func slotSource(item : T.TournamentMatch, slot : T.TournamentSlot) : T.MatchSource {
    switch (slot) { case (#a) { item.sourceA }; case (#b) { item.sourceB } };
  };

  func withSource(item : T.TournamentMatch, slot : T.TournamentSlot, source : T.MatchSource) : T.TournamentMatch {
    switch (slot) {
      case (#a) { { item with sourceA = source; manualOverride = true } };
      case (#b) { { item with sourceB = source; manualOverride = true } };
    };
  };

  func replaceMatch(state : T.TournamentStateData, item : T.TournamentMatch) : T.TournamentStateData {
    { state with matches = state.matches.map(func existing = if (existing.id == item.id) { item } else { existing }) };
  };

  func opening(item : T.TournamentMatch) {
    if (item.bracket != #winners or item.round != 1) { Runtime.trap("Manual placement requires an opening winners-bracket slot") };
  };

  func location(state : T.TournamentStateData, playerId : Nat) : ?(Nat, T.TournamentSlot) {
    for (item in state.matches.values()) {
      if (item.sourceA == #player(playerId)) { return ?(item.id, #a) };
      if (item.sourceB == #player(playerId)) { return ?(item.id, #b) };
    };
    null;
  };

  func eligiblePlayer(state : T.TournamentStateData, id : Nat) {
    if (B.player(state, id).removed) { Runtime.trap("Removed players cannot be placed") };
  };

  func qualifier(id : Nat, bracket : T.TournamentBracket, position : Nat, a : T.MatchSource, b : T.MatchSource) : T.TournamentMatch {
    {
      id; bracket; round = 0; position; sourceA = a; sourceB = b;
      playerA = null; playerB = null; scoreA = null; scoreB = null;
      winnerId = null; loserId = null; status = #blocked; table = null;
      priority = 0; manualOverride = true;
    };
  };

  func place(original : T.TournamentStateData, playerId : Nat, matchId : Nat, slot : T.TournamentSlot, moving : Bool) : T.TournamentStateData {
    eligiblePlayer(original, playerId);
    let target = B.matchById(original, matchId);
    if (moving) {
      // Move the live incoming source, not the historical registration leaf.
      // Equal-round source exchanges preserve prior results and loss lineage.
      let ready = original.matches.find(func item = item.status == #ready and (item.playerA == ?playerId or item.playerB == ?playerId));
      let pending = ready ?? (original.matches.find(func item = item.status == #blocked and (item.playerA == ?playerId or item.playerB == ?playerId)) ?? Runtime.trap("Player has no pending bracket slot to move"));
      if ((pending.bracket != #winners and pending.bracket != #losers) or target.bracket != pending.bracket or target.round != pending.round) {
        Runtime.trap("Move players within their current bracket and round");
      };
      let previousSlot : T.TournamentSlot = if (pending.playerA == ?playerId) { #a } else { #b };
      if (pending.id == matchId and previousSlot == slot) { Runtime.trap("Player already occupies that slot") };
      let incoming = slotSource(pending, previousSlot);
      let displaced = slotSource(target, slot);
      var changed = structural(original, [pending.id, matchId]);
      changed := replaceMatch(changed, withSource(B.matchById(changed, pending.id), previousSlot, displaced));
      return replaceMatch(changed, withSource(B.matchById(changed, matchId), slot, incoming));
    };
    if (target.bracket != #winners) { Runtime.trap("Manual placement requires a winners-bracket match") };
    var state = original;
    switch (location(state, playerId)) {
      case (?previous) {
        if (previous.0 == matchId and previous.1 == slot) { Runtime.trap("Player already occupies that slot") };
        Runtime.trap("Player is already in the bracket; use Move player");
      };
      case null { state := structural(state, [matchId]) };
    };
    let current = B.matchById(state, matchId);
    let oldSource = slotSource(current, slot);
    if (oldSource == #bye) {
      return replaceMatch(state, withSource(current, slot, #player(playerId)));
    };
    // An occupied slot receives a qualification match. Existing results elsewhere
    // keep their IDs, scores, table assignment, and topology.
    let qualifierId = state.nextMatchId;
    let loserQualifierId = qualifierId + 1;
    let wb = { qualifier(qualifierId, #winners, current.position, oldSource, #player(playerId)) with round = Int.abs((current.round : Int) - 1) };
    let lb = qualifier(loserQualifierId, #losers, current.position, #loser(qualifierId), #loser(matchId));
    let ordered = List.empty<T.TournamentMatch>();
    func replaceLoser(source : T.MatchSource) : T.MatchSource {
      if (state.elimination == #doubleElimination and source == #loser(matchId)) { #winner(loserQualifierId) } else { source };
    };
    for (item in state.matches.values()) {
      if (item.id == matchId) {
        ordered.add(wb);
        ordered.add(withSource(item, slot, #winner(qualifierId)));
        if (state.elimination == #doubleElimination) { ordered.add(lb) };
      } else {
        let a = replaceLoser(item.sourceA);
        let b = replaceLoser(item.sourceB);
        ordered.add({ item with sourceA = a; sourceB = b; manualOverride = item.manualOverride or a != item.sourceA or b != item.sourceB });
      };
    };
    { state with matches = ordered.toArray(); nextMatchId = qualifierId + (if (state.elimination == #doubleElimination) { 2 } else { 1 }) };
  };

  func ensureFreeTable(state : T.TournamentStateData, matchId : Nat, number : Nat) {
    if (number < 1 or number > state.tableCount) { Runtime.trap("Table must be between 1 and the configured table count") };
    if (state.matches.any(func item = item.id != matchId and item.table == ?number and (item.status == #playing or item.status == #ready))) {
      Runtime.trap("Table is already occupied");
    };
  };

  func noStartedMatches(state : T.TournamentStateData) {
    if (state.matches.any(func item = item.status == #playing or item.status == #completed)) { Runtime.trap("Bracket format cannot change after a match has started") };
  };

  func reduce(original : T.TournamentStateData, command : T.TournamentCommand, now : Int) : (T.TournamentStateData, Text) {
    let state = B.refresh(original);
    switch (command) {
      case (#configure(input)) {
        if (input.tableCount < 1 or input.tableCount > 20) { Runtime.trap("Configure between 1 and 20 tables") };
        if (state.matches.any(func item = (item.status == #ready or item.status == #playing) and (item.table ?? 0) > input.tableCount)) {
          Runtime.trap("Release occupied tables before reducing the table count");
        };
        var changed = { state with elimination = input.elimination; tableCount = input.tableCount };
        if (input.elimination != state.elimination) {
          noStartedMatches(state);
          if (state.started) { changed := B.generate(changed) };
        };
        (changed, "Configure tournament");
      };
      case (#addPlayer(input)) {
        let name = nameAndSkill(input.name, input.skillLevel);
        if (state.players.filter(func item = not item.removed).size() >= 4096) { Runtime.trap("At most 4096 active players are supported") };
        let registrationNumber = state.nextRegistrationNumber;
        let item : T.TournamentPlayerData = { id = registrationNumber; name; skillLevel = input.skillLevel; registrationNumber; registeredAt = now; removed = false; queuePriority = 0 };
        ({ state with players = state.players.concat([item]); nextRegistrationNumber = registrationNumber + 1 }, "Register " # name);
      };
      case (#editPlayer(input)) {
        ignore B.player(state, input.playerId);
        let name = nameAndSkill(input.name, input.skillLevel);
        ({ state with players = state.players.map(func item = if (item.id == input.playerId) { { item with name; skillLevel = input.skillLevel } } else { item }) }, "Edit " # name);
      };
      case (#removePlayer(input)) {
        let item = B.player(state, input.playerId);
        if (item.removed) { Runtime.trap("Player is already removed") };
        if (not input.confirmed and (location(state, item.id) != null or state.matches.any(func matchItem = matchItem.playerA == ?item.id or matchItem.playerB == ?item.id))) {
          Runtime.trap("Confirm removal because this player is assigned to the bracket");
        };
        ({ state with players = state.players.map(func existing = if (existing.id == item.id) { { existing with removed = true } } else { existing }) }, "Withdraw " # item.name);
      };
      case (#generateBracket) {
        noStartedMatches(state);
        (B.generate(state), "Generate bracket");
      };
      case (#placePlayer(input)) { (place(state, input.playerId, input.matchId, input.slot, false), "Place player manually") };
      case (#movePlayer(input)) { (place(state, input.playerId, input.matchId, input.slot, true), "Move player manually") };
      case (#swapPlayers(input)) {
        let first = B.matchById(state, input.firstMatchId);
        let second = B.matchById(state, input.secondMatchId);
        if (first.id == second.id and input.firstSlot == input.secondSlot) { Runtime.trap("Select two different slots") };
        let bothOpening = first.bracket == #winners and second.bracket == #winners and first.round == 1 and second.round == 1;
        let compatible = (first.bracket == #winners or first.bracket == #losers) and first.status == #ready and second.status == #ready and first.bracket == second.bracket and first.round == second.round;
        if (not bothOpening and not compatible) { Runtime.trap("Swap opening slots or ready matches in the same bracket round") };
        var changed = structural(state, [first.id, second.id]);
        let sourceA = slotSource(first, input.firstSlot);
        let sourceB = slotSource(second, input.secondSlot);
        changed := replaceMatch(changed, withSource(B.matchById(changed, first.id), input.firstSlot, sourceB));
        changed := replaceMatch(changed, withSource(B.matchById(changed, second.id), input.secondSlot, sourceA));
        (changed, "Swap bracket players");
      };
      case (#setMatchPlayers(input)) {
        let item = B.matchById(state, input.matchId); opening(item);
        if (input.playerA != null and input.playerA == input.playerB) { Runtime.trap("A player cannot occupy both sides of a match") };
        for (id in [input.playerA, input.playerB].values()) {
          switch (id) {
            case (?value) {
              eligiblePlayer(state, value);
              switch (location(state, value)) { case (?previous) { if (previous.0 != item.id) { Runtime.trap("Player already occupies another bracket slot") } }; case null {} };
            };
            case null {};
          };
        };
        let changed = structural(state, [item.id]);
        (replaceMatch(changed, { B.matchById(changed, item.id) with sourceA = switch (input.playerA) { case (?id) { #player(id) }; case null { #bye } }; sourceB = switch (input.playerB) { case (?id) { #player(id) }; case null { #bye } }; manualOverride = true }), "Set custom matchup");
      };
      case (#assignBye(input)) {
        let item = B.matchById(state, input.matchId); opening(item);
        let changed = structural(state, [item.id]);
        (replaceMatch(changed, withSource(B.matchById(changed, item.id), input.slot, #bye)), "Assign manual bye");
      };
      case (#assignTable(input)) {
        let item = B.matchById(state, input.matchId);
        if (item.status != #ready and item.status != #playing) { Runtime.trap("Only a ready or playing match can be assigned a table") };
        switch (input.table) { case (?number) { ensureFreeTable(state, item.id, number) }; case null { if (item.status == #playing) { Runtime.trap("Reset a playing match before releasing its table") } } };
        (replaceMatch(state, { item with table = input.table; manualOverride = true }), "Assign table");
      };
      case (#startMatch(id)) {
        let item = B.matchById(state, id);
        if (item.status != #ready) { Runtime.trap("Only a ready match can start") };
        if (state.matches.any(func other = other.id != id and other.status == #playing and (other.playerA == item.playerA or other.playerB == item.playerA or other.playerA == item.playerB or other.playerB == item.playerB))) {
          Runtime.trap("A player is already playing another match");
        };
        var number = item.table;
        if (number == null) {
          for (candidate in Nat.rangeInclusive(1, state.tableCount)) {
            if (not state.matches.any(func other = other.table == ?candidate and (other.status == #ready or other.status == #playing))) { number := ?candidate; break };
          };
        };
        let assigned = number ?? Runtime.trap("No table is available");
        ensureFreeTable(state, id, assigned);
        (replaceMatch(state, { item with status = #playing; table = ?assigned }), "Start match");
      };
      case (#recordResult(input)) {
        var item = B.matchById(state, input.matchId);
        if (item.status != #ready and item.status != #playing and item.status != #completed) { Runtime.trap("Only a ready, playing, or completed match accepts a score") };
        if (input.scoreA == input.scoreB) { Runtime.trap("A match cannot finish with a tied score") };
        if (input.scoreA > 999 or input.scoreB > 999) { Runtime.trap("Scores must be at most 999") };
        let a = item.playerA ?? Runtime.trap("First participant is missing");
        let b = item.playerB ?? Runtime.trap("Second participant is missing");
        let winnerId = if (input.scoreA > input.scoreB) { a } else { b };
        let loserId = if (winnerId == a) { b } else { a };
        var changed = state;
        if (item.status == #completed and item.winnerId != ?winnerId) {
          let ids = affected(state, [item.id]);
          for (dependent in state.matches.values()) {
            if (dependent.id != item.id and ids.contains(dependent.id) and (dependent.status == #completed or dependent.status == #playing)) { Runtime.trap("Reset dependent matches before changing the winner") };
          };
          changed := { state with matches = state.matches.map(func dependent = if (dependent.id != item.id and ids.contains(dependent.id)) { clear(dependent) } else { dependent }) };
        };
        item := { item with status = #completed; scoreA = ?input.scoreA; scoreB = ?input.scoreB; winnerId = ?winnerId; loserId = ?loserId; manualOverride = item.manualOverride or item.status == #completed };
        (replaceMatch(changed, item), "Record match result");
      };
      case (#resetMatch(input)) {
        ignore B.matchById(state, input.matchId);
        let ids = affected(state, [input.matchId]);
        for (item in state.matches.values()) {
          if (item.id != input.matchId and ids.contains(item.id)) {
            if (item.status == #playing) { Runtime.trap("Reset playing dependent matches first") };
            if (item.status == #completed and not input.cascade) { Runtime.trap("Confirm cascade to reset completed dependent matches") };
          };
        };
        ({ state with matches = state.matches.map(func item = if (ids.contains(item.id)) { { clear(item) with manualOverride = true } } else { item }) }, "Reset match and advancement");
      };
      case (#prioritizeMatch(id)) {
        let item = B.matchById(state, id);
        if (item.status != #ready and item.status != #blocked) { Runtime.trap("Only pending matches can be prioritized") };
        (replaceMatch(state, { item with priority = -now; manualOverride = true }), "Prioritize match");
      };
      case (#prioritizePlayer(id)) {
        eligiblePlayer(state, id);
        ({ state with players = state.players.map(func item = if (item.id == id) { { item with queuePriority = -now } } else { item }); matches = state.matches.map(func item = if (item.status == #ready and (item.playerA == ?id or item.playerB == ?id)) { { item with manualOverride = true } } else { item }) }, "Move player to front of queue");
      };
      case (#undo) { Runtime.trap("Undo must be handled before reducing a command") };
    };
  };

  public func apply(state : T.TournamentStateData, command : T.TournamentCommand, now : Int) : T.TournamentStateData {
    switch (command) {
      case (#undo) {
        if (state.history.size() == 0) { Runtime.trap("There is no action to undo") };
        let count = state.history.size();
        let snapshot = state.history[count - 1].snapshot;
        // Counters live outside snapshots: undo cannot reuse a registration,
        // match, or action ID that an organizer has already seen.
        return B.refresh({ state with elimination = snapshot.elimination; tableCount = snapshot.tableCount; started = snapshot.started; players = snapshot.players; matches = snapshot.matches; history = state.history.sliceToArray(0, (count : Int) - 1); updatedAt = now });
      };
      case _ {};
    };
    let (changed, caption) = reduce(state, command, now);
    let entry : T.TournamentHistoryEntry = {
      action = { id = state.nextActionId; caption; createdAt = now };
      snapshot = { elimination = state.elimination; tableCount = state.tableCount; started = state.started; players = state.players; matches = state.matches };
    };
    let history = state.history.concat([entry]);
    let retained = if (history.size() > 30) { history.sliceToArray((history.size() : Int) - 30, history.size()) } else { history };
    B.refresh({ changed with history = retained; nextActionId = state.nextActionId + 1; updatedAt = now });
  };
};
