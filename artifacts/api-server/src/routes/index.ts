import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import meetingsRouter from "./meetings";
import emailDraftsRouter from "./emailDrafts";
import configRouter from "./config";
import usageRouter from "./usage";
import importRouter from "./import";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requestsRouter);
router.use(meetingsRouter);
router.use(emailDraftsRouter);
router.use(configRouter);
router.use(usageRouter);
router.use(importRouter);

export default router;
