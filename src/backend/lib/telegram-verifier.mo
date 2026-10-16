import Array "mo:core/Array";
import Base64 "mo:core/Base64";
import Blob "mo:core/Blob";
import Iter "mo:core/Iter";
import Nat "mo:core/Nat";
import Nat8 "mo:core/Nat8";
import Text "mo:core/Text";
import Json "mo:json";
import Sha256 "mo:sha2/Sha256";
import Telegram "../types/telegram";

// Only Telegram's default RS256 algorithm is accepted. We deliberately ignore
// token-supplied URLs/keys: verification keys come from the fixed Telegram JWKS.
module {
  public let issuer = "https://oauth.telegram.org";
  public let jwksUrl = "https://oauth.telegram.org/.well-known/jwks.json";
  public let maxTokenBytes : Nat = 16_384;
  public let maxJwksBytes : Nat = 32_768;
  public let challengeLifetime : Int = 300_000_000_000;
  let clockSkewSeconds : Int = 60;

  public type Outcome<T> = { #ok : T; #err : Text };
  public type Claims = { subject : Text; username : Text; avatarUrl : ?Text };
  public type Token = {
    kid : Text;
    message : Blob;
    signature : Blob;
    claims : Claims;
  };
  public type RsaKey = { kid : Text; modulus : Blob; exponent : Nat };

  public func base64UrlEncode(value : Blob) : Text {
    Base64.encode(value).replace(#char '+', "-").replace(#char '/', "_").replace(#char '=', "");
  };

  func base64UrlDecode(value : Text) : ?Blob {
    if (value == "" or value.size() % 4 == 1) { return null };
    for (c in value.chars()) {
      if (not ((c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or c == '-' or c == '_')) {
        return null;
      };
    };
    let ?decoded = Base64.decode(value.replace(#char '-', "+").replace(#char '_', "/")) else return null;
    // Core's decoder accepts discarded trailing bits. JWT/JWK encoding must
    // instead have exactly the canonical, unpadded base64url representation.
    if (base64UrlEncode(decoded) != value) { return null };
    ?decoded;
  };

  // Bound parser nesting before parsing untrusted text, and reject duplicate
  // keys instead of letting differently implemented JWT parsers disagree.
  func boundedJson(value : Text) : Outcome<Json.Json> {
    var depth = 0;
    var quoted = false;
    var escaped = false;
    for (c in value.chars()) {
      if (quoted) {
        if (escaped) { escaped := false } else if (c == '\\') { escaped := true } else if (c == '\"') { quoted := false };
      } else if (c == '\"') { quoted := true } else if (c == '{' or c == '[') {
        depth += 1;
        if (depth > 8) { return #err("Telegram token JSON is too deeply nested") };
      } else if (c == '}' or c == ']') {
        if (depth == 0) { return #err("Invalid Telegram token JSON") };
        depth -= 1;
      };
    };
    switch (Json.parse(value)) {
      case (#err _) { #err("Invalid Telegram token JSON") };
      case (#ok parsed) {
        if (uniqueKeys(parsed)) { #ok(parsed) } else { #err("Duplicate Telegram token JSON key") };
      };
    };
  };

  func uniqueKeys(value : Json.Json) : Bool {
    switch (value) {
      case (#object_ entries) {
        if (entries.size() > 128) { return false };
        var i = 0;
        for ((key, item) in entries.values()) {
          var j = 0;
          while (j < i) { if (entries[j].0 == key) { return false }; j += 1 };
          if (not uniqueKeys(item)) { return false };
          i += 1;
        };
      };
      case (#array items) {
        if (items.size() > 128) { return false };
        for (item in items.values()) { if (not uniqueKeys(item)) { return false } };
      };
      case _ {};
    };
    true;
  };

  func field(value : Json.Json, name : Text) : ?Json.Json {
    switch (value) {
      case (#object_ entries) { for ((key, item) in entries.values()) { if (key == name) { return ?item } } };
      case _ {};
    };
    null;
  };

  func textField(value : Json.Json, name : Text) : ?Text {
    switch (field(value, name)) { case (?#string text) { ?text }; case _ { null } };
  };

  func intField(value : Json.Json, name : Text) : ?Int {
    switch (field(value, name)) { case (?#number(#int number)) { ?number }; case _ { null } };
  };

  public func validUsername(username : Text) : Bool {
    if (username.size() < 5 or username.size() > 32) { return false };
    for (c in username.chars()) {
      if (not ((c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or c == '_')) { return false };
    };
    true;
  };

  // The picture is optional profile metadata, never an identity proof. Accept
  // only a bounded HTTPS URL from the signed payload; malformed/missing photos
  // must not prevent linking. No image is fetched by the canister.
  func picture(payload : Json.Json) : ?Text {
    let ?value = textField(payload, "picture") else return null;
    if (value.size() > 2_048 or value.encodeUtf8().size() > 2_048) { return null };
    let ?rest = value.stripStart(#text "https://") else return null;
    for (c in value.chars()) {
      if (c <= ' ' or c == '\u{007f}' or c == '\\' or c == '\"' or c == '<' or c == '>') { return null };
    };
    let ?authority = rest.split(#predicate(func c = c == '/' or c == '?' or c == '#')).next() else return null;
    let hostParts = authority.split(#char ':').toArray();
    if (hostParts.size() == 0 or hostParts.size() > 2) { return null };
    let host = hostParts[0];
    if (host.size() == 0 or host.size() > 253) { return null };
    for (segment in host.split(#char '.')) {
      if (segment.size() == 0 or segment.size() > 63 or segment.startsWith(#char '-') or segment.endsWith(#char '-')) { return null };
      for (c in segment.chars()) {
        if (not ((c >= 'a' and c <= 'z') or (c >= 'A' and c <= 'Z') or (c >= '0' and c <= '9') or c == '-')) { return null };
      };
    };
    if (hostParts.size() == 2) {
      let ?port = Nat.fromText(hostParts[1]) else return null;
      if (port == 0 or port > 65_535) { return null };
    };
    ?value;
  };

  public func parseToken(idToken : Text, challenge : Telegram.Challenge, now : Int) : Outcome<Token> {
    if (idToken.size() > maxTokenBytes or idToken.encodeUtf8().size() > maxTokenBytes) { return #err("Telegram token is too large") };
    if (now >= challenge.expiresAt) { return #err("Telegram link expired. Try linking again.") };
    let parts = idToken.split(#char '.').toArray();
    if (parts.size() != 3) { return #err("Invalid Telegram token") };
    let ?headerBytes = base64UrlDecode(parts[0]) else return #err("Invalid Telegram token encoding");
    let ?payloadBytes = base64UrlDecode(parts[1]) else return #err("Invalid Telegram token encoding");
    let ?signature = base64UrlDecode(parts[2]) else return #err("Invalid Telegram signature encoding");
    let ?headerText = headerBytes.decodeUtf8() else return #err("Invalid Telegram token encoding");
    let ?payloadText = payloadBytes.decodeUtf8() else return #err("Invalid Telegram token encoding");
    let header = switch (boundedJson(headerText)) { case (#ok value) { value }; case (#err error) { return #err(error) } };
    let payload = switch (boundedJson(payloadText)) { case (#ok value) { value }; case (#err error) { return #err(error) } };
    if (textField(header, "alg") != ?"RS256") { return #err("Telegram Login must use the RS256 signing algorithm") };
    if (field(header, "crit") != null or field(header, "b64") != null) { return #err("Unsupported Telegram token header") };
    let ?kid = textField(header, "kid") else return #err("Telegram token has no key ID");
    if (kid.size() == 0 or kid.size() > 100) { return #err("Invalid Telegram key ID") };
    if (textField(payload, "iss") != ?issuer) { return #err("Invalid Telegram token issuer") };
    if (textField(payload, "aud") != ?challenge.clientId) { return #err("Telegram token was issued for another app") };
    if (textField(payload, "nonce") != ?challenge.nonce) { return #err("Telegram link verification did not match. Try linking again.") };
    let ?subject = textField(payload, "sub") else return #err("Telegram token has no account ID");
    if (subject.size() == 0 or subject.size() > 128) { return #err("Invalid Telegram account ID") };
    for (c in subject.chars()) { if (c < '0' or c > '9') { return #err("Invalid Telegram account ID") } };
    let ?issuedAt = intField(payload, "iat") else return #err("Telegram token has no issue time");
    let ?expiresAt = intField(payload, "exp") else return #err("Telegram token has no expiration time");
    let nowSeconds = now / 1_000_000_000;
    if (expiresAt <= nowSeconds or issuedAt > nowSeconds + clockSkewSeconds or issuedAt < challenge.createdAt / 1_000_000_000 - clockSkewSeconds or expiresAt <= issuedAt) {
      return #err("Telegram token expired or has an invalid timestamp");
    };
    switch (field(payload, "nbf")) {
      case null {};
      case (?#number(#int notBefore)) { if (notBefore > nowSeconds + clockSkewSeconds) { return #err("Telegram token is not valid yet") } };
      case _ { return #err("Invalid Telegram token timestamp") };
    };
    let ?username = textField(payload, "preferred_username") else return #err("Set a Telegram username before linking.");
    if (not validUsername(username)) { return #err("Set a valid Telegram username before linking.") };
    #ok({ kid; message = Text.encodeUtf8(parts[0] # "." # parts[1]); signature; claims = { subject; username = username.toLower(); avatarUrl = picture(payload) } });
  };

  func fromBytes(bytes : Blob) : Nat {
    var value = 0;
    for (byte in bytes.values()) { value := value * 256 + byte.toNat() };
    value;
  };

  public func parseKeys(body : Text) : Outcome<[RsaKey]> {
    if (body.size() > maxJwksBytes or body.encodeUtf8().size() > maxJwksBytes) { return #err("Telegram verification keys are too large") };
    let parsed = switch (boundedJson(body)) { case (#ok value) { value }; case (#err error) { return #err(error) } };
    let ?(#array keys) = field(parsed, "keys") else return #err("Invalid Telegram verification keys");
    let result = keys.filterMap(func(key) {
      if (textField(key, "kty") != ?"RSA" or textField(key, "alg") != ?"RS256") { return null };
      switch (textField(key, "use")) { case (?use) { if (use != "sig") { return null } }; case null {} };
      switch (field(key, "key_ops")) {
        case (?#array operations) { if (not operations.any(func(operation) = operation == #string("verify"))) { return null } };
        case null {};
        case _ { return null };
      };
      let ?kid = textField(key, "kid") else return null;
      let ?n = textField(key, "n") else return null;
      let ?e = textField(key, "e") else return null;
      let ?modulus = base64UrlDecode(n) else return null;
      let ?exponent = base64UrlDecode(e) else return null;
      // Bounded, full-size 2048-4096 bit RSA and Telegram's standard exponent.
      if (kid.size() == 0 or kid.size() > 100 or modulus.size() < 256 or modulus.size() > 512 or modulus[0] < 128 or modulus[modulus.size() - 1] % 2 != 1 or exponent.size() > 4 or fromBytes(exponent) != 65_537) { return null };
      ?{ kid; modulus; exponent = 65_537 };
    });
    if (result.size() == 0) { return #err("Telegram RS256 verification key is unavailable") };
    // Duplicate kid is ambiguous even if the RSA moduli happen to agree.
    var i = 0;
    for (key in result.values()) {
      var j = 0;
      while (j < i) { if (result[j].kid == key.kid) { return #err("Ambiguous Telegram verification key") }; j += 1 };
      i += 1;
    };
    #ok(result);
  };

  func modularPower(base : Nat, exponent : Nat, modulus : Nat) : Nat {
    var result = 1;
    var factor = base % modulus;
    var power = exponent;
    while (power > 0) {
      if (power % 2 == 1) { result := (result * factor) % modulus };
      power /= 2;
      if (power > 0) { factor := (factor * factor) % modulus };
    };
    result;
  };

  // RFC 8017 RSASSA-PKCS1-v1_5: compare the entire encoded message, including
  // every padding byte and the exact SHA-256 DigestInfo DER prefix. Checking
  // only a trailing digest would permit forged RSA signatures.
  public func validSignature(token : Token, key : RsaKey) : Bool {
    let size = key.modulus.size();
    if (token.signature.size() != size) { return false };
    let signature = fromBytes(token.signature);
    let modulus = fromBytes(key.modulus);
    if (signature >= modulus) { return false };
    let decoded = modularPower(signature, key.exponent, modulus);
    let digest = Sha256.fromBlob(#sha256, token.message);
    let prefix : [Nat8] = [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20];
    if (size < prefix.size() + digest.size() + 11) { return false };
    let separator = Nat.sub(size, prefix.size() + digest.size() + 1);
    var expected : Nat = 0;
    var i = 0;
    while (i < size) {
      let byte : Nat8 = if (i == 0 or i == separator) { 0 } else if (i == 1) { 1 } else if (i < separator) { 255 } else if (i < separator + 1 + prefix.size()) {
        prefix[i - separator - 1];
      } else { digest[i - separator - 1 - prefix.size()] };
      expected := expected * 256 + byte.toNat();
      i += 1;
    };
    decoded == expected;
  };

  public func verify(token : Token, keys : [RsaKey]) : Outcome<Claims> {
    let ?key = keys.find(func(key) = key.kid == token.kid) else return #err("Telegram verification key has changed. Try linking again.");
    if (not validSignature(token, key)) { return #err("Invalid Telegram token signature") };
    #ok(token.claims);
  };

  // Strip fluctuating response headers and normalize only supported RSA keys
  // so HTTP responses can reach consensus even if JSON formatting changes.
  public func canonicalKeys(body : Text) : Outcome<Text> {
    switch (parseKeys(body)) {
      case (#err error) { #err(error) };
      case (#ok keys) {
        let sorted = keys.sort(func(a, b) = Text.compare(a.kid, b.kid));
        #ok(Json.stringify(#object_([("keys", #array(sorted.map(func(key) = #object_([
          ("alg", #string("RS256")), ("kty", #string("RSA")), ("kid", #string(key.kid)),
          ("n", #string(base64UrlEncode(key.modulus))), ("e", #string("AQAB")),
        ]))))]), null));
      };
    };
  };
};
