import { Router, type IRouter } from "express";
import healthRouter from "./health";
import requestsRouter from "./requests";
import meetingsRouter from "./meetings";
import emailDraftsRouter from "./emailDrafts";
import configRouter from "./config";

const router: IRouter = Router();

router.use(healthRouter);
router.use(requestsRouter);
router.use(meetingsRouter);
router.use(emailDraftsRouter);
router.use(configRouter);

export default router;
