/**
 * An account still on a one-time password may only change it. The server answers every other
 * request with 403, this error code and this header; the screens send the person to
 * /change-password when they see it.
 */
export const PASSWORD_CHANGE_REQUIRED = "PASSWORD_CHANGE_REQUIRED";
export const PASSWORD_CHANGE_REQUIRED_HEADER = "X-Password-Change-Required";
