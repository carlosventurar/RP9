/**
 * Frontend Analytics Events
 * Instrumentación para tracking de funnel y outcomes
 */

import { signBody } from '../security/hmac';

interface BaseEvent {
  tenant_id: string;
  user_id?: string;
  timestamp?: string;
  metadata?: Record<string, any>;
}

interface FunnelEvent extends BaseEvent {
  type: 'funnel';
  step: 'wizard_start' | 'template_install' | 'first_execution' | 'first_success';
  event_name: string;
  template_id?: string;
  workflow_id?: string;
}

interface OutcomeEvent extends BaseEvent {
  type: 'outcome';
  outcome_type: 'first_victory' | 'continuous';
  category: 'cfdi' | 'ticket' | 'email' | 'payment' | 'invoice' | 'report' | 'other';
  event_name: string;
  value_usd?: number;
  hours_saved?: number;
}

type AnalyticsEvent = FunnelEvent | OutcomeEvent;

class AnalyticsTracker {
  private tenantId: string;
  private userId?: string;
  private endpoint: string;
  private webhookSecret: string;
  private enabled: boolean;

  constructor(config: {
    tenantId: string;
    userId?: string;
    endpoint?: string;
    webhookSecret?: string;
    enabled?: boolean;
  }) {
    this.tenantId = config.tenantId;
    this.userId = config.userId;
    this.endpoint = config.endpoint || '/api/analytics/ingest';
    this.webhookSecret = config.webhookSecret || process.env.NEXT_PUBLIC_ANALYTICS_WEBHOOK_SECRET || '';
    this.enabled = config.enabled ?? process.env.NODE_ENV === 'production';
  }

  private async sendEvent(event: AnalyticsEvent): Promise<void> {
    if (!this.enabled || !this.webhookSecret) {
      console.debug('Analytics tracking disabled or no webhook secret');
      return;
    }

    try {
      const eventPayload = {
        ...event,
        tenant_id: this.tenantId,
        user_id: this.userId || event.user_id,
        timestamp: event.timestamp || new Date().toISOString()
      };

      const body = JSON.stringify(eventPayload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const signature = signBody(body, timestamp, this.webhookSecret);

      await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-RP9-Signature': signature,
          'X-RP9-Timestamp': timestamp
        },
        body
      });

      console.debug('Analytics event sent:', event.type, event.event_name);
    } catch (error) {
      console.error('Failed to send analytics event:', error);
      // En caso de error, podríamos almacenar en localStorage para retry
      this.storeFailedEvent(event);
    }
  }

  private storeFailedEvent(event: AnalyticsEvent): void {
    try {
      const failedEvents = JSON.parse(localStorage.getItem('rp9_failed_events') || '[]');
      failedEvents.push({
        ...event,
        failed_at: new Date().toISOString()
      });
      
      // Mantener solo los últimos 50 eventos fallidos
      const recentEvents = failedEvents.slice(-50);
      localStorage.setItem('rp9_failed_events', JSON.stringify(recentEvents));
    } catch (error) {
      console.error('Failed to store failed event:', error);
    }
  }

  public async retryFailedEvents(): Promise<void> {
    try {
      const failedEvents = JSON.parse(localStorage.getItem('rp9_failed_events') || '[]');
      if (failedEvents.length === 0) return;

      console.debug(`Retrying ${failedEvents.length} failed analytics events`);

      for (const event of failedEvents) {
        await this.sendEvent(event);
      }

      // Limpiar eventos exitosos
      localStorage.removeItem('rp9_failed_events');
    } catch (error) {
      console.error('Failed to retry events:', error);
    }
  }

  // FUNNEL EVENTS
  
  public async trackWizardStart(data: {
    template_category?: string;
    referrer?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<void> {
    await this.sendEvent({
      type: 'funnel',
      step: 'wizard_start',
      event_name: 'onboarding_wizard_started',
      tenant_id: this.tenantId,
      metadata: {
        template_category: data.template_category,
        referrer: data.referrer,
        user_agent: navigator.userAgent,
        ...data.metadata
      }
    });
  }

  public async trackTemplateInstall(data: {
    template_id: string;
    template_name?: string;
    category?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.sendEvent({
      type: 'funnel',
      step: 'template_install',
      event_name: 'template_installed',
      template_id: data.template_id,
      tenant_id: this.tenantId,
      metadata: {
        template_name: data.template_name,
        category: data.category,
        install_method: 'manual', // o 'guided', 'bulk', etc.
        ...data.metadata
      }
    });
  }

  public async trackFirstExecution(data: {
    workflow_id: string;
    template_id?: string;
    execution_mode?: 'manual' | 'trigger' | 'webhook';
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.sendEvent({
      type: 'funnel',
      step: 'first_execution',
      event_name: 'first_workflow_execution',
      workflow_id: data.workflow_id,
      template_id: data.template_id,
      tenant_id: this.tenantId,
      metadata: {
        execution_mode: data.execution_mode || 'manual',
        ...data.metadata
      }
    });
  }

  public async trackFirstSuccess(data: {
    workflow_id: string;
    template_id?: string;
    execution_time_ms?: number;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.sendEvent({
      type: 'funnel',
      step: 'first_success',
      event_name: 'first_workflow_success',
      workflow_id: data.workflow_id,
      template_id: data.template_id,
      tenant_id: this.tenantId,
      metadata: {
        execution_time_ms: data.execution_time_ms,
        completion_rate: 100,
        ...data.metadata
      }
    });
  }

  // OUTCOME EVENTS

  public async trackFirstVictory(data: {
    category: OutcomeEvent['category'];
    description: string;
    value_usd?: number;
    hours_saved?: number;
    workflow_id?: string;
    template_id?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.sendEvent({
      type: 'outcome',
      outcome_type: 'first_victory',
      category: data.category,
      event_name: 'first_victory_achieved',
      value_usd: data.value_usd,
      hours_saved: data.hours_saved,
      tenant_id: this.tenantId,
      metadata: {
        description: data.description,
        workflow_id: data.workflow_id,
        template_id: data.template_id,
        achievement_milestone: true,
        ...data.metadata
      }
    });
  }

  public async trackContinuousOutcome(data: {
    category: OutcomeEvent['category'];
    description: string;
    value_usd?: number;
    hours_saved?: number;
    workflow_id?: string;
    template_id?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    await this.sendEvent({
      type: 'outcome',
      outcome_type: 'continuous',
      category: data.category,
      event_name: 'continuous_value_generated',
      value_usd: data.value_usd,
      hours_saved: data.hours_saved,
      tenant_id: this.tenantId,
      metadata: {
        description: data.description,
        workflow_id: data.workflow_id,
        template_id: data.template_id,
        ...data.metadata
      }
    });
  }

  // CONVENIENCE METHODS POR CATEGORIA

  public async trackCFDIGenerated(data: {
    cfdi_count: number;
    total_amount_mxn?: number;
    hours_saved?: number;
    workflow_id?: string;
  }): Promise<void> {
    await this.trackContinuousOutcome({
      category: 'cfdi',
      description: `Generated ${data.cfdi_count} CFDI documents`,
      value_usd: data.total_amount_mxn ? data.total_amount_mxn * 0.05 : undefined, // 5% del valor como estimación
      hours_saved: data.hours_saved || data.cfdi_count * 0.25, // 15 min por CFDI
      workflow_id: data.workflow_id,
      metadata: {
        cfdi_count: data.cfdi_count,
        total_amount_mxn: data.total_amount_mxn
      }
    });
  }

  public async trackTicketCreated(data: {
    ticket_count: number;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    hours_saved?: number;
    workflow_id?: string;
  }): Promise<void> {
    await this.trackContinuousOutcome({
      category: 'ticket',
      description: `Created ${data.ticket_count} support tickets`,
      hours_saved: data.hours_saved || data.ticket_count * 0.17, // 10 min por ticket
      workflow_id: data.workflow_id,
      metadata: {
        ticket_count: data.ticket_count,
        priority: data.priority
      }
    });
  }

  public async trackEmailsSent(data: {
    email_count: number;
    campaign_type?: string;
    hours_saved?: number;
    workflow_id?: string;
  }): Promise<void> {
    await this.trackContinuousOutcome({
      category: 'email',
      description: `Sent ${data.email_count} automated emails`,
      hours_saved: data.hours_saved || data.email_count * 0.08, // 5 min por email
      workflow_id: data.workflow_id,
      metadata: {
        email_count: data.email_count,
        campaign_type: data.campaign_type
      }
    });
  }

  public async trackPaymentProcessed(data: {
    payment_count: number;
    total_amount_usd: number;
    hours_saved?: number;
    workflow_id?: string;
  }): Promise<void> {
    await this.trackContinuousOutcome({
      category: 'payment',
      description: `Processed ${data.payment_count} payments`,
      value_usd: data.total_amount_usd * 0.02, // 2% como fee estimado
      hours_saved: data.hours_saved || data.payment_count * 0.33, // 20 min por payment
      workflow_id: data.workflow_id,
      metadata: {
        payment_count: data.payment_count,
        total_amount_usd: data.total_amount_usd
      }
    });
  }

  public async trackReportGenerated(data: {
    report_type: string;
    data_points?: number;
    hours_saved?: number;
    workflow_id?: string;
  }): Promise<void> {
    await this.trackContinuousOutcome({
      category: 'report',
      description: `Generated ${data.report_type} report`,
      hours_saved: data.hours_saved || 2, // 2 horas por reporte por defecto
      workflow_id: data.workflow_id,
      metadata: {
        report_type: data.report_type,
        data_points: data.data_points
      }
    });
  }
}

// Singleton instance
let analyticsInstance: AnalyticsTracker | null = null;

export function initAnalytics(config: {
  tenantId: string;
  userId?: string;
  enabled?: boolean;
}): AnalyticsTracker {
  analyticsInstance = new AnalyticsTracker({
    ...config,
    webhookSecret: process.env.NEXT_PUBLIC_ANALYTICS_WEBHOOK_SECRET || ''
  });
  
  // Retry failed events on init
  if (typeof window !== 'undefined') {
    setTimeout(() => {
      analyticsInstance?.retryFailedEvents();
    }, 2000);
  }
  
  return analyticsInstance;
}

export function getAnalytics(): AnalyticsTracker | null {
  return analyticsInstance;
}

export { AnalyticsTracker };