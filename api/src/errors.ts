/**
 * An error whose message is shown to the shop owner as-is (Thai, no jargon).
 * The frontend displays `message` for 400/409/422 responses.
 */
export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const notFound = (message: string) => new ApiError(404, message);
export const conflict = (message: string) => new ApiError(409, message);
