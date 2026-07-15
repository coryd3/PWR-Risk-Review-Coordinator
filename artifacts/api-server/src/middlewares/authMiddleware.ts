import { type Request, type Response, type NextFunction } from "express";
import type { AuthUser } from "@workspace/api-zod";

declare global {
  namespace Express {
    interface User extends AuthUser {}

    interface Request {
      isAuthenticated(): this is AuthedRequest;

      user?: User | undefined;
    }

    export interface AuthedRequest {
      user: User;
    }
  }
}

// Databricks platform handles authentication. Every request that reaches
// this app has already been verified. We trust the platform and always
// set req.user so downstream route handlers see an authenticated user.
export async function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const email = (
    (req.headers["x-forwarded-email"] as string) ||
    (req.headers["x-forwarded-preferred-username"] as string) ||
    "cldavis@burnsmcd.com"
  ).trim().toLowerCase();

  req.user = {
    id: email,
    email,
    firstName: email.split("@")[0],
    lastName: null,
    profileImageUrl: null,
    role: "admin" as const,
  };

  req.isAuthenticated = function (this: Request) {
    return this.user != null;
  } as Request["isAuthenticated"];

  next();
}
