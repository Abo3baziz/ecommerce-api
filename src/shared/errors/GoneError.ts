import { AppError } from "./AppError.js";

export class GoneError extends AppError {
  constructor(message = "Resource is no longer available") {
    super(message, 410);
  }
}
