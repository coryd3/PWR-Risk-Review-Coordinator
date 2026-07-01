import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import requestsRouter from "./requests";
import meetingsRouter from "./meetings";
import emailDraftsRouter from "./emailDrafts";
import configRouter from "./config";
import usageRouter from "./usage";
import importRouter from "./import";
import { authorizeByRole } from "../lib/roles";

const router: IRouter = Router();

// Public routers (no auth required).
router.use(healthRouter);
router.use(authRouter);

// Everything below requires an authenticated user with a permitted role.
router.use(authorizeByRole);

router.use(usersRouter);
router.use(requestsRouter);
router.use(meetingsRouter);
router.use(emailDraftsRouter);
router.use(configRouter);
router.use(usageRouter);
router.use(importRouter);

export default router;
