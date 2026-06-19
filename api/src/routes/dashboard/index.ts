import { Router } from 'express';
import { dashboardAuth } from '../../middleware/dashboardAuth';
import { leadsRouter }    from './leads';
import { statsRouter }    from './stats';
import { pipelineRouter } from './pipeline';
import { outreachRouter } from './outreach';
import { settingsRouter } from './settings';
import { sessionsRouter } from './sessions';

export const dashboardRouter = Router();

// All dashboard routes require NextAuth JWT
dashboardRouter.use(dashboardAuth);

dashboardRouter.use('/leads',    leadsRouter);
dashboardRouter.use('/stats',    statsRouter);
dashboardRouter.use('/pipeline', pipelineRouter);
dashboardRouter.use('/outreach', outreachRouter);
dashboardRouter.use('/settings', settingsRouter);
dashboardRouter.use('/sessions', sessionsRouter);
