import express, { Request, Response } from 'express';
import axios from 'axios';
import { config } from './config';
import { BulkEvaluationItem, FeatureFlagClient } from './featureFlagClient';

const app = express();
const featureFlagClient = new FeatureFlagClient();

app.use(express.json());

type SessionSource = 'live' | 'lkg' | 'default';

type PlanType = 'basic' | 'premium';

const FLAGS_TO_EVALUATE = ['focus_tracking', 'brain_monitoring_3d', 'focus_model_v2'];

const SAFE_DEFAULTS: Record<string, boolean> = {
  focus_tracking: false,
  brain_monitoring_3d: false,
  focus_model_v2: false
};

const lkgByInstitute = new Map<string, { timestamp: number; evaluations: BulkEvaluationItem[] }>();

function toFeatureMap(evaluations: BulkEvaluationItem[]): Record<string, boolean> {
  const map: Record<string, boolean> = {};
  for (const item of evaluations) {
    map[item.flagKey] = Boolean(item.enabled);
  }

  for (const [flagKey, defaultEnabled] of Object.entries(SAFE_DEFAULTS)) {
    if (typeof map[flagKey] !== 'boolean') {
      map[flagKey] = defaultEnabled;
    }
  }

  return map;
}

function parsePlan(value: unknown): PlanType {
  if (value === 'premium') {
    return 'premium';
  }
  return 'basic';
}

app.get('/start-session', async (req: Request, res: Response) => {
  const instituteId = req.query.instituteId;
  const userId = req.query.userId;
  const plan = parsePlan(req.query.plan);

  if (typeof instituteId !== 'string' || instituteId.trim().length === 0) {
    return res.status(400).json({
      message: 'instituteId query parameter is required'
    });
  }

  if (typeof userId !== 'string' || userId.trim().length === 0) {
    return res.status(400).json({
      message: 'userId query parameter is required'
    });
  }

  const normalizedInstituteId = instituteId.trim();
  const normalizedUserId = userId.trim();

  let source: SessionSource = 'live';
  let evaluations: BulkEvaluationItem[] = [];

  try {
    evaluations = await featureFlagClient.evaluateBulk({
      flagKeys: FLAGS_TO_EVALUATE,
      instituteId: normalizedInstituteId,
      userId: normalizedUserId,
      plan
    });

    lkgByInstitute.set(normalizedInstituteId, {
      timestamp: Date.now(),
      evaluations
    });
  } catch (error) {
    const lkg = lkgByInstitute.get(normalizedInstituteId);
    const isLkgUsable = Boolean(lkg && Date.now() - lkg.timestamp <= config.lkgMaxAgeMs);

    if (isLkgUsable && lkg) {
      source = 'lkg';
      evaluations = lkg.evaluations;
    } else {
      source = 'default';
      evaluations = Object.entries(SAFE_DEFAULTS).map(([flagKey, enabled]) => ({
        flagKey,
        enabled,
        reason: 'SAFE_DEFAULT'
      }));
    }

    const message = axios.isAxiosError(error)
      ? error.response?.data?.message || error.message || error.code || 'Feature flag API request failed'
      : error instanceof Error
        ? error.message
        : 'Unknown error';

    console.error(`[Session Start] Feature evaluation error for instituteId=${normalizedInstituteId}: ${message}`);
  }

  const features = toFeatureMap(evaluations);
  const enabledFeatures = Object.keys(features).filter((key) => features[key]);
  const disabledFeatures = Object.keys(features).filter((key) => !features[key]);

  console.log(`[Session Start] instituteId=${normalizedInstituteId} userId=${normalizedUserId} plan=${plan} source=${source}`);
  console.log(`[Session Start] Enabled features: ${enabledFeatures.join(', ') || 'none'}`);
  console.log(`[Session Start] Disabled features: ${disabledFeatures.join(', ') || 'none'}`);

  return res.status(200).json({
    instituteId: normalizedInstituteId,
    userId: normalizedUserId,
    plan,
    source,
    evaluatedAt: new Date().toISOString(),
    features,
    enabledFeatures,
    disabledFeatures
  });
});

app.listen(config.port, () => {
  console.log(`learning-runtime-mock listening on port ${config.port}`);
});
