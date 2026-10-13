module {
  public type Config = { clientId : ?Text };
  public type ConfigState = { var clientId : ?Text };
  public type Link = { subject : Text; username : Text; linkedAt : Int };
  public type Challenge = {
    nonce : Text;
    clientId : Text;
    createdAt : Int;
    expiresAt : Int;
  };
  public type LinkRequest = { clientId : Text; nonce : Text; expiresAt : Int };
  public type CachedKeys = { body : Text; expiresAt : Int };
  public type CacheState = { var keys : ?CachedKeys };
};
