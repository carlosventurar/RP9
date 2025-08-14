# Terms of Service - {{company_name}}

**Version:** {{version}}  
**Effective Date:** {{effective_date}}  
**Last Modified:** {{last_modified}}  
**Jurisdiction:** {{jurisdiction}}  
**Language:** English

## 1. Acceptance of Terms

By accessing or using {{company_name}} services ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Service.

## 2. Service Description

{{company_name}} is a business automation platform that enables organizations to create, manage, and execute automated workflows. The Service includes:

- Workflow creation tools
- Pre-designed templates for multiple industries
- Integrations with 400+ third-party services
- Real-time analytics and reporting
- Specialized technical support {{support_coverage}}

## 3. User Accounts

### 3.1 Account Registration
- You must provide accurate and current information during registration
- You are responsible for maintaining the confidentiality of your credentials
- You must immediately notify us of any unauthorized use of your account
- {{company_name}} reserves the right to suspend accounts with false information

### 3.2 Account Types
- **{{plan_starter}}**: Basic plan for small teams (up to {{starter_users}} users)
- **{{plan_pro}}**: Advanced plan for growing businesses (up to {{pro_users}} users)
- **{{plan_enterprise}}**: Custom plan for large organizations (unlimited users)

## 4. Acceptable Use

### 4.1 Permitted Uses
- Automation of legitimate business processes
- Integration with your own systems and data
- Creation of workflows for your organization
- Sharing public templates with the community (optional)

### 4.2 Prohibited Uses
- Illegal activities or violations of third-party rights
- Distribution of malware or malicious content
- Excessive use that affects service performance
- Reverse engineering or unauthorized access attempts
- Resale or redistribution of the service without authorization

## 5. Billing and Payments

### 5.1 Pricing
- Prices are set according to the selected plan
- Prices may vary by region and local currency
- Taxes will be applied as applicable by country
- Discounts available for annual payments

### 5.2 Billing
- Billing is recurring ({{billing_cycle}})
- Payments are automatically processed on {{billing_day}}
- Access is suspended for non-payment after {{grace_period}} days
- Expiration notifications are sent {{notice_days}} days in advance

### 5.3 Refunds
- Payments are non-refundable except for service defects
- You may cancel at any time (no refund for current period)
- Credits for downtime according to our {{sla_percentage}}% SLA

## 6. Privacy and Security

### 6.1 Data Protection
- Your data is processed according to our Privacy Policy
- We implement SOC2 Type II security measures and CIS controls
- We do not share your data without explicit consent
- We comply with applicable {{data_regulations}}

### 6.2 Data Ownership
- You retain complete ownership of your data
- You grant us license to process your data according to these Terms
- You can export your data at any time in standard formats
- Guaranteed deletion within {{data_retention}} days after cancellation

## 7. Intellectual Property

### 7.1 Service Ownership
- {{company_name}} and its technology are exclusive property of the company
- You are granted a limited, non-transferable license to use the Service

### 7.2 User Content
- You retain all rights to your workflows and data
- You grant us license to host, process, and deliver your content
- {{#if opt_out}}You can opt-out of aggregated data use for improvements{{/if}}

## 8. Service Availability and SLA

### 8.1 Uptime
- We guarantee {{sla_percentage}}% monthly availability
- Exclusions: scheduled maintenance with {{maintenance_notice}} hours notice
- 24/7 monitoring with automatic alerts

### 8.2 SLA Credits
If we fail to meet our SLA, we provide automatic credits:
{{#each sla_penalties}}
- {{uptime_min}}% - {{uptime_max}}%: {{credit_percent}}% credit
{{/each}}

### 8.3 Service Modifications
- We may modify or discontinue features with {{feature_notice}} days notice
- Important changes will be notified by email and dashboard
- New features may be included at no additional cost

## 9. Support and Response Times

### 9.1 Support Levels
- **P1 (Critical)**: {{support_p1}} - Service completely inoperative
- **P2 (High)**: {{support_p2}} - Main functionality affected
- **P3 (Medium)**: {{support_p3}} - Minor issues or inquiries

### 9.2 Support Channels
- 24/7 support portal at {{support_url}}
- Email: {{support_email}}
- Live chat: Business hours {{business_hours}}
- Phone support: Enterprise plans only

## 10. Limitation of Liability

### 10.1 Disclaimer of Warranties
- The service is provided "as is"
- We do not guarantee it is completely error-free
- Your use is at your own risk and discretion

### 10.2 Damage Limitation
- Our liability is limited to the amount paid in the last {{liability_months}} months
- Maximum liability: {{max_liability}}
- We are not responsible for indirect, consequential damages or lost profits
- Exceptions: personal data breach or intellectual property violation ({{carveout_multiplier}}x liability)

## 11. Termination

### 11.1 Termination by You
- You may cancel your account at any time from the dashboard
- Data will be retained for {{data_retention}} days after cancellation
- Data export available during retention period

### 11.2 Termination by Us
{{#if plan_enterprise}}
- We can only terminate Enterprise contracts for just cause
- {{enterprise_notice}} days advance notice for termination for cause
{{else}}
- We may terminate your account with {{termination_notice}} days notice
- Immediate termination for violation of these Terms
{{/if}}

## 12. Governing Law and Dispute Resolution

### 12.1 Jurisdiction
- These Terms are governed by the laws of {{jurisdiction}}
- Competent courts: {{court_jurisdiction}}
- Mandatory arbitration through {{arbitration_body}}

### 12.2 Applicable Law by Country
{{#each countries}}
- **{{name}}**: {{data_law}} - {{enforcement_agency}}
{{/each}}

### 12.3 Mediation
- Disputes will be resolved preferably by mediation
- Mediation language will be Spanish
- Mediation venue: {{mediation_place}}

## 13. Subprocessors and Third Parties

We maintain an updated list of subprocessors at {{subprocessors_url}}.
Changes are notified {{subprocessor_notice}} days in advance.

Main subprocessors:
{{#each subprocessors}}
- **{{name}}**: {{purpose}} ({{location}})
{{/each}}

## 14. Modifications

We may modify these Terms at any time. Important changes will be notified:
- By email with {{notice_period}} days advance notice
- Through the service control panel
- On our website {{website_url}}

Continued use after changes constitutes acceptance.

## 15. Contact

For questions about these Terms:
- **Legal Email**: {{legal_email}}
- **Support Email**: {{support_email}}
- **Address**: {{company_address}}
- **Phone**: {{company_phone}}

---

**Document Information:**
- **Document ID**: {{document_id}}
- **Version**: {{version}}
- **Language**: English ({{language_code}})
- **Generation Date**: {{generation_date}}
- **Integrity Hash**: {{document_hash}}

*These Terms of Service are effective as of {{effective_date}} and replace all previous versions.*