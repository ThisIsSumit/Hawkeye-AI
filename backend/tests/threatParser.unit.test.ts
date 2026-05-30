import { beforeEach, describe, expect, it } from 'vitest';
import { parse, resetParserStateForTests } from '../src/services/threatParser.js';
import { authFailedLoginLog, rawLogs } from './fixtures/rawLogs.js';

describe('threatParser unit tests', () => {
  beforeEach(() => {
    resetParserStateForTests();
  });

  it('detects SQL injection from nginx-style payload', () => {
    const threat = parse(rawLogs.nginxSqli);

    expect(threat).not.toBeNull();
    expect(threat?.attackType).toBe('SQL Injection');
    expect(threat?.severity).toBe('critical');
    expect(threat?.sourceIp).toBe(rawLogs.nginxSqli.sourceIp);
  });

  it('returns null for benign traffic', () => {
    const threat = parse(rawLogs.nginxBenign);

    expect(threat).toBeNull();
  });

  it('emits brute-force threat only after threshold is reached', () => {
    const ip = '10.11.12.13';

    for (let i = 0; i < 4; i += 1) {
      const result = parse(authFailedLoginLog(ip, 'root'));
      expect(result).toBeNull();
    }

    const fifth = parse(authFailedLoginLog(ip, 'root'));

    expect(fifth).not.toBeNull();
    expect(fifth?.attackType).toBe('Brute Force');
    expect(fifth?.severity).toBe('medium');
    expect(fifth?.attempts).toBe(5);
  });

  it('detects XSS from WAF style payload', () => {
    const threat = parse(rawLogs.wafXss);

    expect(threat).not.toBeNull();
    expect(threat?.attackType).toBe('XSS');
    expect(threat?.severity).toBe('high');
  });

  it('detects SSRF from cloud finding metadata-style text', () => {
    const threat = parse(rawLogs.guardDutySsrf);

    expect(threat).not.toBeNull();
    expect(threat?.attackType).toBe('SSRF');
    expect(threat?.severity).toBe('high');
  });

  it('detects DDoS/scan signature from IDS style payload', () => {
    const threat = parse(rawLogs.idsPortScan);

    expect(threat).not.toBeNull();
    expect(threat?.attackType).toBe('DDoS');
    expect(threat?.severity).toBe('high');
  });

  it('detects command injection from firewall style payload', () => {
    const threat = parse(rawLogs.firewallCommandInjection);

    expect(threat).not.toBeNull();
    expect(threat?.attackType).toBe('Command Injection');
    expect(threat?.severity).toBe('critical');
  });
});
