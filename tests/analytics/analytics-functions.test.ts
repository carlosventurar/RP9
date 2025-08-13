/**
 * Tests para funciones críticas de Analytics
 * Pruebas básicas de las APIs y lógica de negocio
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock de Supabase
const mockSupabase = {
  from: jest.fn(() => mockSupabase),
  select: jest.fn(() => mockSupabase),
  insert: jest.fn(() => mockSupabase),
  upsert: jest.fn(() => mockSupabase),
  eq: jest.fn(() => mockSupabase),
  gte: jest.fn(() => mockSupabase),
  lte: jest.fn(() => mockSupabase),
  order: jest.fn(() => mockSupabase),
  limit: jest.fn(() => mockSupabase),
  single: jest.fn(() => Promise.resolve({ data: null, error: null })),
  rpc: jest.fn(() => Promise.resolve({ data: null, error: null }))
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock de HMAC
jest.mock('../../lib/security/hmac', () => ({
  signBody: jest.fn(() => 'mocked-signature'),
  verifySignature: jest.fn(() => true)
}));

// Mock de Rate Limiting
jest.mock('../../lib/security/rate-limit', () => ({
  checkRateLimit: jest.fn(() => Promise.resolve(true))
}));

describe('Analytics Functions Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    process.env.ANALYTICS_WEBHOOK_SECRET = 'test-secret';
    process.env.INTERNAL_API_KEY = 'test-internal-key';
  });

  describe('Analytics Ingest Function', () => {
    test('should accept valid funnel event', async () => {
      const { handler } = await import('../../netlify/functions/analytics-ingest');
      
      const event = {
        httpMethod: 'POST',
        headers: {
          'x-rp9-signature': 'valid-signature',
          'x-rp9-timestamp': Math.floor(Date.now() / 1000).toString()
        },
        body: JSON.stringify({
          type: 'funnel',
          tenant_id: 'test-tenant',
          event_name: 'wizard_start',
          step: 'wizard_start'
        })
      };

      mockSupabase.single.mockResolvedValueOnce({ data: {}, error: null });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
    });

    test('should reject invalid event type', async () => {
      const { handler } = await import('../../netlify/functions/analytics-ingest');
      
      const event = {
        httpMethod: 'POST',
        headers: {
          'x-rp9-signature': 'valid-signature',
          'x-rp9-timestamp': Math.floor(Date.now() / 1000).toString()
        },
        body: JSON.stringify({
          type: 'invalid',
          tenant_id: 'test-tenant',
          event_name: 'test'
        })
      };

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(400);
    });

    test('should require signature headers', async () => {
      const { handler } = await import('../../netlify/functions/analytics-ingest');
      
      const event = {
        httpMethod: 'POST',
        headers: {},
        body: JSON.stringify({
          type: 'funnel',
          tenant_id: 'test-tenant',
          event_name: 'test'
        })
      };

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Analytics KPIs Function', () => {
    test('should return executive KPIs', async () => {
      const { handler } = await import('../../netlify/functions/analytics-kpis');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          dashboard: 'executive',
          period: '30d',
          tenant_id: 'test-tenant'
        }
      };

      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: [{ roi_usd: 1000, ttv_days_avg: 5, adoption_rate: 80 }], 
        error: null 
      });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      expect(body.dashboard).toBe('executive');
      expect(body.data).toBeDefined();
    });

    test('should validate required parameters', async () => {
      const { handler } = await import('../../netlify/functions/analytics-kpis');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          dashboard: 'executive'
          // Missing tenant_id
        }
      };

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(400);
    });

    test('should validate dashboard type', async () => {
      const { handler } = await import('../../netlify/functions/analytics-kpis');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          dashboard: 'invalid',
          tenant_id: 'test-tenant'
        }
      };

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Analytics Export Function', () => {
    test('should export KPIs as CSV', async () => {
      const { handler } = await import('../../netlify/functions/analytics-export');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'kpis',
          format: 'csv',
          tenant_id: 'test-tenant',
          period: '7d'
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ 
        data: [
          { date: '2024-01-01', executions_total: 100, executions_success: 95 },
          { date: '2024-01-02', executions_total: 120, executions_success: 110 }
        ], 
        error: null 
      });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('text/csv');
      expect(response.body).toContain('fecha,ejecuciones_total');
    });

    test('should export data as JSON', async () => {
      const { handler } = await import('../../netlify/functions/analytics-export');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'kpis',
          format: 'json',
          tenant_id: 'test-tenant'
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ 
        data: [{ date: '2024-01-01', executions_total: 100 }], 
        error: null 
      });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      
      const body = JSON.parse(response.body);
      expect(body.metadata).toBeDefined();
      expect(body.data).toBeDefined();
    });

    test('should validate export type', async () => {
      const { handler } = await import('../../netlify/functions/analytics-export');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'invalid',
          tenant_id: 'test-tenant'
        }
      };

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(400);
    });
  });

  describe('Analytics Report Function', () => {
    test('should generate monthly report', async () => {
      const { handler } = await import('../../netlify/functions/analytics-report');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'monthly',
          month: '2024-01',
          tenant_id: 'test-tenant'
        }
      };

      // Mock tenant data
      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: 'test-tenant', name: 'Test Tenant', plan: 'enterprise' }, 
        error: null 
      });

      // Mock executive data
      mockSupabase.rpc.mockResolvedValueOnce({ 
        data: [{ roi_usd: 2000, hours_saved_total: 100, cost_total_usd: 500 }], 
        error: null 
      });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('text/html');
      expect(response.body).toContain('Reporte Analytics Mensual');
    });

    test('should return JSON format when requested', async () => {
      const { handler } = await import('../../netlify/functions/analytics-report');
      
      const event = {
        httpMethod: 'GET',
        queryStringParameters: {
          type: 'monthly',
          month: '2024-01',
          tenant_id: 'test-tenant',
          format: 'json'
        }
      };

      mockSupabase.single.mockResolvedValueOnce({ 
        data: { id: 'test-tenant', name: 'Test Tenant', plan: 'enterprise' }, 
        error: null 
      });

      const response = await handler(event, {} as any, {} as any);
      expect(response.statusCode).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('Analytics Events Frontend Library', () => {
    test('should initialize analytics tracker', async () => {
      const { initAnalytics } = await import('../../src/lib/analytics/events');
      
      const tracker = initAnalytics({
        tenantId: 'test-tenant',
        userId: 'test-user'
      });

      expect(tracker).toBeDefined();
    });

    test('should track funnel events', async () => {
      const { AnalyticsTracker } = await import('../../src/lib/analytics/events');
      
      // Mock fetch
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        })
      ) as jest.Mock;

      const tracker = new AnalyticsTracker({
        tenantId: 'test-tenant',
        enabled: true,
        webhookSecret: 'test-secret'
      });

      await tracker.trackWizardStart({ template_category: 'finance' });
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analytics/ingest',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    test('should track outcome events', async () => {
      const { AnalyticsTracker } = await import('../../src/lib/analytics/events');
      
      global.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({})
        })
      ) as jest.Mock;

      const tracker = new AnalyticsTracker({
        tenantId: 'test-tenant',
        enabled: true,
        webhookSecret: 'test-secret'
      });

      await tracker.trackFirstVictory({
        category: 'cfdi',
        description: 'Generated first CFDI',
        hours_saved: 2
      });

      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('Utility Functions', () => {
    test('should convert data to CSV format', () => {
      const data = [
        { name: 'John', age: 30, city: 'Madrid' },
        { name: 'Jane', age: 25, city: 'Barcelona' }
      ];

      // Esta función estaría en analytics-export.ts
      const csvHeaders = Object.keys(data[0]).join(',');
      const csvRows = data.map(row => Object.values(row).join(','));
      const csv = [csvHeaders, ...csvRows].join('\n');

      expect(csv).toBe('name,age,city\nJohn,30,Madrid\nJane,25,Barcelona');
    });

    test('should format currency correctly', () => {
      const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('es-AR', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(value);
      };

      expect(formatCurrency(1000)).toContain('$');
      expect(formatCurrency(1000)).toContain('1000');
    });

    test('should calculate ROI correctly', () => {
      const calculateROI = (hoursSaved: number, hourlyRate: number, platformCost: number) => {
        const value = hoursSaved * hourlyRate;
        return value - platformCost;
      };

      expect(calculateROI(100, 50, 1000)).toBe(4000); // 100 * 50 - 1000 = 4000
      expect(calculateROI(10, 50, 1000)).toBe(-500);  // 10 * 50 - 1000 = -500
    });
  });
});

describe('Analytics Data Validation', () => {
  test('should validate funnel event structure', () => {
    const isValidFunnelEvent = (event: any) => {
      return (
        event.type === 'funnel' &&
        event.tenant_id &&
        event.event_name &&
        event.step &&
        ['wizard_start', 'template_install', 'first_execution', 'first_success'].includes(event.step)
      );
    };

    expect(isValidFunnelEvent({
      type: 'funnel',
      tenant_id: 'test',
      event_name: 'test',
      step: 'wizard_start'
    })).toBe(true);

    expect(isValidFunnelEvent({
      type: 'funnel',
      tenant_id: 'test',
      event_name: 'test',
      step: 'invalid_step'
    })).toBe(false);
  });

  test('should validate outcome event structure', () => {
    const isValidOutcomeEvent = (event: any) => {
      return (
        event.type === 'outcome' &&
        event.tenant_id &&
        event.event_name &&
        event.outcome_type &&
        event.category &&
        ['first_victory', 'continuous'].includes(event.outcome_type) &&
        ['cfdi', 'ticket', 'email', 'payment', 'invoice', 'report', 'other'].includes(event.category)
      );
    };

    expect(isValidOutcomeEvent({
      type: 'outcome',
      tenant_id: 'test',
      event_name: 'test',
      outcome_type: 'first_victory',
      category: 'cfdi'
    })).toBe(true);

    expect(isValidOutcomeEvent({
      type: 'outcome',
      tenant_id: 'test',
      event_name: 'test',
      outcome_type: 'invalid',
      category: 'cfdi'
    })).toBe(false);
  });
});