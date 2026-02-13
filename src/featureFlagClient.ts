import axios, { AxiosInstance } from 'axios';
import { config } from './config';

export interface BulkEvaluationItem {
  flagKey: string;
  enabled: boolean;
  reason?: string;
}

interface BulkEvaluateResponse {
  evaluations: BulkEvaluationItem[];
  evaluatedAt?: string;
}

export class FeatureFlagClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: config.featureFlagApiUrl,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey
      }
    });
  }

  async evaluateBulk(input: {
    flagKeys: string[];
    instituteId: string;
    userId: string;
    plan: string;
  }): Promise<BulkEvaluationItem[]> {
    const response = await this.http.post<BulkEvaluateResponse>('/api/v1/evaluate/bulk', {
      flagKeys: input.flagKeys,
      context: {
        // Current feature-flag-api evaluates by userId; pass instituteId for institute-level targeting.
        userId: input.instituteId,
        attributes: {
          instituteId: input.instituteId,
          userId: input.userId,
          plan: input.plan
        }
      }
    });

    return Array.isArray(response.data?.evaluations) ? response.data.evaluations : [];
  }
}
