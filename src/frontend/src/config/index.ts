/** Shared limits for club member records. */
export const config = {
  maxDisplayNameLength: 80,
  maxUsernameLength: 30,
  maxBioLength: 500,
} as const;
export type Config = typeof config;
