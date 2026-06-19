import { Router } from 'express';
import { workerAuth } from '../../middleware/workerAuth';
import { pingRouter }    from './ping';
import { sessionRouter } from './session';
import { leadsRouter }   from './leads';
import { reviewsRouter } from './reviews';
import { configRouter }  from './config';

export const workerRouter = Router();

// All worker routes require token authentication
workerRouter.use(workerAuth);

workerRouter.use('/ping',    pingRouter);
workerRouter.use('/session', sessionRouter);
workerRouter.use('/leads',   leadsRouter);
workerRouter.use('/lead',    reviewsRouter);
workerRouter.use('/config',  configRouter);
