export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.statusCode = status;
  }
}

export default {
  HttpError,
};