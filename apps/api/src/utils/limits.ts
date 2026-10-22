// Text limits the API validates with. `GET /api/catalog` serves them as `limits`, so clients
// cap their inputs with the same numbers instead of copying them.

export const MAX_BIO_LENGTH = 300;
export const MAX_PROFILE_LINKS = 5;
export const MAX_PROFILE_LINK_LENGTH = 200;
export const MAX_REVIEW_LENGTH = 5000;
export const MAX_PLAYTHROUGH_NOTE_LENGTH = 1000;
export const MAX_LIST_NAME_LENGTH = 100;
export const MAX_LIST_DESCRIPTION_LENGTH = 1000;
/** Better Auth's email/password bounds (`emailAndPassword` in src/lib/auth.ts) */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

export const textLimits = () => ({
  bioLength: MAX_BIO_LENGTH,
  profileLinks: MAX_PROFILE_LINKS,
  profileLinkLength: MAX_PROFILE_LINK_LENGTH,
  reviewLength: MAX_REVIEW_LENGTH,
  playthroughNoteLength: MAX_PLAYTHROUGH_NOTE_LENGTH,
  listNameLength: MAX_LIST_NAME_LENGTH,
  listDescriptionLength: MAX_LIST_DESCRIPTION_LENGTH,
  passwordMinLength: MIN_PASSWORD_LENGTH,
  passwordMaxLength: MAX_PASSWORD_LENGTH,
});
