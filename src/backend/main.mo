import Map "mo:core/Map";
import Principal "mo:core/Principal";
import AccessControl "mo:caffeineai-authorization/access-control";
import MixinAuthorization "mo:caffeineai-authorization/MixinAuthorization";
import Expose "mo:caffeineai-oql/Expose";
import Entity "mo:caffeineai-oql/Entity";
import MapEntity "mo:caffeineai-oql/MapEntity";
import NatValue "mo:caffeineai-oql/NatValue";
import IntValue "mo:caffeineai-oql/IntValue";
import TextValue "mo:caffeineai-oql/TextValue";
import PrincipalValue "mo:caffeineai-oql/PrincipalValue";
import MixinObjectStorage "mo:caffeineai-object-storage/Mixin";
import Common "types/common";
import Users "types/users";
import Tournaments "types/tournaments";
import UsersApi "mixins/users-api";
import TournamentsApi "mixins/tournaments-api";
import RolesApi "mixins/roles-api";
import TournamentsLib "lib/tournaments";
import RolesLib "lib/roles";
import ApiDocMixin "mixins/api-doc";

actor {
  func roleToText(role : ?Users.Role) : Text {
    switch (role) { case (?#admin) { "admin" }; case null { "user" } };
  };

  let accessControlState : AccessControl.AccessControlState;
  let users : Map.Map<Common.UserId, Users.User>;
  let usernames : Map.Map<Text, Common.UserId>;
  let tournaments : Map.Map<Nat, Tournaments.Tournament>;
  let tournamentStates : Map.Map<Nat, Tournaments.TournamentStateData>;
  let counters : Common.Counters;
  let owner : Common.OwnerState;

  include MixinAuthorization(accessControlState, null);
  include MixinObjectStorage();
  include UsersApi(accessControlState, users, usernames, owner);
  include TournamentsApi(accessControlState, tournaments, tournamentStates, counters);
  include RolesApi(accessControlState, users, owner);
  include ApiDocMixin();

  include Expose({
    entities = [
      users.toEntityManual("user", "User", "id")
        .sample({ id = Principal.fromText("aaaaa-aa"); displayName = ""; username = ""; avatar = null; bio = null; createdAt = 0; role = null })
        .payload("id", func user = user.id)
        .payload("displayName", func user = user.displayName)
        .payload("username", func user = user.username)
        .payload("bio", func user = user.bio ?? "")
        .payload("role", func user = roleToText(RolesLib.effectiveRole(accessControlState, users, owner, user.id)))
        .payload("createdAt", func user = user.createdAt)
        .public_()
        .build(),
      tournaments.toEntityManual("tournament", "Tournament", "id")
        .sample({ id = 0; title = ""; description = ""; venue = ""; startsAt = 0; format = #singles; capacity = 0; status = #upcoming; createdAt = 0; updatedAt = 0 })
        .payload("id", func tournament = tournament.id)
        .payload("title", func tournament = tournament.title)
        .payload("description", func tournament = tournament.description)
        .payload("venue", func tournament = tournament.venue)
        .payload("startsAt", func tournament = tournament.startsAt)
        .payload("format", func tournament = TournamentsLib.formatToText(tournament.format))
        .payload("capacity", func tournament = tournament.capacity)
        .payload("status", func tournament = TournamentsLib.statusToText(tournament.status))
        .payload("createdAt", func tournament = tournament.createdAt)
        .payload("updatedAt", func tournament = tournament.updatedAt)
        .public_()
        .build(),
    ];
  });
};
