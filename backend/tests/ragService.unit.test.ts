import { beforeEach, describe, expect, it } from 'vitest';

import { ragService } from '../src/services/ragService.js';
import { store } from '../src/services/store.js';

function resetStore() {
  const mutableStore = store as unknown as {
    threats: unknown[];
    alerts: unknown[];
    analyses: Map<string, unknown>;
    totalEvents: number;
    blockedCount: number;
  };

  mutableStore.threats = [];
  mutableStore.alerts = [];
  mutableStore.analyses = new Map();
  mutableStore.totalEvents = 0;
  mutableStore.blockedCount = 0;
}

describe('ragService.query', () => {
  beforeEach(() => {
    resetStore();
    process.env.OPENROUTER_API_KEY = '';
    process.env.OPENROUTER_MODEL = 'openrouter/auto';
  });

  it('answers frequent-attack questions from analytics instead of keyword matches', async () => {
    store.ingestThreat({
      sourceIp: '10.0.0.1',
      country: 'USA',
      countryCode: 'US',
      asn: 'AS1',
      attackType: 'DDoS',
      endpoint: '/api/login',
      severity: 'high',
      attempts: 8,
      userAgent: 'tester',
    });

    store.ingestThreat({
      sourceIp: '10.0.0.2',
      country: 'USA',
      countryCode: 'US',
      asn: 'AS2',
      attackType: 'DDoS',
      endpoint: '/api/search',
      severity: 'high',
      attempts: 4,
      userAgent: 'tester',
    });

    store.ingestThreat({
      sourceIp: '10.0.0.3',
      country: 'Germany',
      countryCode: 'DE',
      asn: 'AS3',
      attackType: 'XSS',
      endpoint: '/admin',
      severity: 'medium',
      attempts: 2,
      userAgent: 'tester',
    });

    const result = await ragService.query('which attack is frequent');

    expect(result.answer).toContain('DDoS');
    expect(result.answer).toContain('2');
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.mode).toBe('keyword');
  });
});