# Privacy Policy - {{company_name}}

**Version:** {{version}}  
**Effective Date:** {{effective_date}}  
**Last Modified:** {{last_modified}}  
**Jurisdiction:** {{jurisdiction}}  
**Language:** English

## 1. General Information

{{company_name}} ("we", "our", "the company") respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, store, and protect your information when you use our services.

**Data Controller:** {{company_name}}  
**Address:** {{company_address}}  
**DPO Email:** {{dpo_email}}  
**Phone:** {{company_phone}}

## 2. Data We Collect

### 2.1 Identification Data
- Full name and surname
- Professional email address
- Business phone number
- Job title and company name
- {{#if tax_collection}}Tax information ({{tax_id_field}} for billing){{/if}}

### 2.2 Service Usage Data
- IP addresses and approximate geolocation
- Browser and device information
- Platform activity logs
- Workflow and integration usage metrics
- Session time and navigation patterns

### 2.3 Communication Data
- Technical support conversations
- Service feedback and comments
- Participation in satisfaction surveys and studies
- Ticket history and requests

### 2.4 Billing Data
- Credit card information (tokenized by {{payment_processor}})
- Transaction and payment history
- Enterprise billing data
- Bank information for refunds (if applicable)

### 2.5 User-Generated Data
- Created workflows and automations
- Integration configurations
- Custom templates
- {{#unless opt_out}}Aggregated and anonymized data for product improvements{{/unless}}

## 3. Legal Basis and Processing Purposes

### 3.1 Contract Performance
- Provision of automation services
- User account management
- Technical support and customer service
- Billing and payment management

### 3.2 Legitimate Interest
- Product improvement and development
- Usage analysis and performance optimization
- Fraud prevention and security
- Direct marketing to existing customers

### 3.3 Legal Compliance
- Retention of tax records according to {{data_regulations}}
- Cooperation with competent authorities
- Security and compliance audits
- Fulfillment of accounting obligations

### 3.4 Consent
- Newsletter and promotional communications
- Market research and surveys
- Beta program participation
- Public testimonials and use cases

## 4. Data Sharing with Third Parties

### 4.1 Authorized Subprocessors
We share data only with subprocessors that meet equivalent security standards:

{{#each subprocessors}}
- **{{name}}** ({{location}}): {{purpose}}
  - Certifications: {{certifications}}
  - Data processed: {{data_categories}}
{{/each}}

### 4.2 International Transfers
- Some subprocessors operate outside {{local_region}}
- We use {{data_authority}} standard contractual clauses (SCC)
- Transfer mechanisms: {{transfer_mechanisms}}

### 4.3 Disclosure Required by Law
- Valid court order or legal requirement
- Prevention of fraud or illegal activity
- Protection of rights, property, or safety

## 5. Data Security

### 5.1 Technical Measures
- Encryption in transit (TLS 1.3) and at rest (AES-256)
- Mandatory multi-factor authentication
- 24/7 security monitoring
- {{security_certifications}} certification

### 5.2 Organizational Measures
- Access based on least privilege principle
- Regular staff privacy training
- {{audit_frequency}} security audits
- Documented incident response plan

### 5.3 Impact Assessments
- DPIA conducted for high-risk processing
- International transfer risk assessments
- {{pentest_frequency}} penetration testing

## 6. Data Retention

### 6.1 Retention Periods by Type
- **Active account data**: During contract validity
- **System logs**: {{logs_retention}} days
- **Billing data**: {{billing_retention}} years (tax requirement)
- **Security backups**: {{backup_retention}} days
- **Support data**: {{support_retention}} years after resolution

### 6.2 Secure Deletion
- Cryptographic deletion of encrypted data
- Multiple overwriting for unencrypted data
- Destruction certificates for physical media
- User notification of completed deletion

## 7. Your Rights

### 7.1 Fundamental Rights
- **Access**: Obtain copy of your personal data
- **Rectification**: Correct incorrect or incomplete data
- **Erasure**: Request deletion under certain circumstances
- **Restriction**: Limit processing in specific cases
- **Portability**: Receive data in structured format
- **Objection**: Object to processing by legitimate interest

### 7.2 Exercising Rights
- **Privacy portal**: {{privacy_portal_url}}
- **Email**: {{privacy_email}}
- **Response time**: {{response_time}} business days
- **Identity verification**: Required for protection

### 7.3 Right to Complain
- Competent supervisory authority: {{data_authority}}
- Website: {{authority_url}}
- Phone: {{authority_phone}}

## 8. Cookies and Tracking Technologies

### 8.1 Types of Cookies
- **Essential**: Basic platform functionality
- **Functional**: Personalization and preferences
- **Analytics**: Usage and performance metrics ({{analytics_provider}})
- **Marketing**: Personalized advertising (with consent)

### 8.2 Cookie Control
- Settings at {{cookie_settings_url}}
- Browser configuration
- Third-party blocking plugins
- Provider-specific opt-out

## 9. Minors

- Our services are directed at businesses and professionals
- We do not knowingly collect data from minors under {{min_age}} years
- If we detect minor data, we delete it immediately
- Parents can contact us at {{privacy_email}}

## 10. Changes to this Policy

### 10.1 Change Notification
- Email with {{notice_period}} days advance notice for important changes
- Notification in platform dashboard
- Archive of previous versions at {{policy_archive_url}}

### 10.2 Acceptance
- Continued use constitutes acceptance of minor changes
- Substantial changes require explicit consent
- Right to cancel service if you don't accept changes

## 11. Contact and Information

### 11.1 Data Protection Officer (DPO)
- **Name**: {{dpo_name}}
- **Email**: {{dpo_email}}
- **Address**: {{dpo_address}}
- **Hours**: {{dpo_hours}}

### 11.2 Company Information
- **Legal Name**: {{legal_entity_name}}
- **Registry**: {{company_registry}}
- **{{tax_id_label}}**: {{company_tax_id}}
- **EU Representative**: {{eu_representative}} (if applicable)

## 12. Applicable Regulations

This policy complies with:
{{#each regulations}}
- **{{name}}** ({{jurisdiction}}): {{description}}
{{/each}}

## 13. Definitions

- **Personal Data**: Information that identifies or makes a person identifiable
- **Processing**: Any operation performed with personal data
- **Controller**: Who determines the purposes and means of processing
- **Processor**: Who processes data on behalf of the controller
- **Data Subject**: Person whose data is subject to processing

---

**Document Information:**
- **Document ID**: {{document_id}}
- **Version**: {{version}}
- **Language**: English ({{language_code}})
- **Generation Date**: {{generation_date}}
- **Integrity Hash**: {{document_hash}}

**To exercise your rights or privacy inquiries:**
- **Email**: {{privacy_email}}
- **Portal**: {{privacy_portal_url}}
- **Phone**: {{privacy_phone}}

*This Privacy Policy is effective as of {{effective_date}} and replaces all previous versions.*