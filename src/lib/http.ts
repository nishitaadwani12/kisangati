import { Request, Response, NextFunction, RequestHandler } from "express";

// Wrap async route handlers so thrown errors reach Express' error middleware.
export const ah =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) =>
    fn(req, res, next).catch(next);

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}
