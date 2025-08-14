# Acuerdo Marco de Servicios (MSA) - {{company_name}}

**Entre:** {{company_name}} y {{client_company}}  
**Fecha:** {{signature_date}}  
**Vigencia:** {{contract_duration}}  
**Jurisdicción:** {{jurisdiction}}  
**Idioma:** Español

---

## 1. Partes del Contrato

**PROVEEDOR:**
- **Nombre**: {{company_name}}
- **Dirección**: {{company_address}}
- **{{tax_id_label}}**: {{company_tax_id}}
- **Representante Legal**: {{company_representative}}

**CLIENTE:**
- **Nombre**: {{client_company}}
- **Dirección**: {{client_address}}
- **{{client_tax_id_label}}**: {{client_tax_id}}
- **Representante Legal**: {{client_representative}}

## 2. Objeto del Acuerdo

{{company_name}} proporcionará servicios de automatización empresarial a {{client_company}} bajo los términos y condiciones establecidos en este Acuerdo Marco y las Órdenes de Trabajo específicas que se ejecuten bajo el mismo.

### 2.1 Servicios Incluidos
- Plataforma de automatización de workflows
- Plantillas personalizadas para {{client_industry}}
- Integraciones con sistemas existentes del Cliente
- Soporte técnico {{support_level}}
- Capacitación inicial y documentación
- {{#if custom_development}}Desarrollo personalizado según Statement of Work{{/if}}

### 2.2 Alcance Geográfico
Este acuerdo aplica para operaciones en: {{geographic_scope}}

## 3. Términos Comerciales

### 3.1 Modelo de Precios
- **Plan Base**: {{base_plan}} - {{base_price}} {{currency}}/{{billing_period}}
- **Usuarios Adicionales**: {{user_price}} {{currency}} por usuario/mes
- **Almacenamiento Adicional**: {{storage_price}} {{currency}} por GB/mes
- **Ejecuciones Premium**: {{execution_price}} {{currency}} por 1,000 ejecuciones

### 3.2 Facturación y Pagos
- **Ciclo de Facturación**: {{billing_cycle}}
- **Método de Pago**: {{payment_method}}
- **Términos de Pago**: {{payment_terms}} días
- **Moneda**: {{currency}}
- **Impuestos**: {{tax_treatment}}

### 3.3 Ajustes de Precios
- Los precios pueden ajustarse anualmente con {{price_increase_notice}} días de aviso
- Aumentos no excederán {{max_price_increase}}% anual
- {{#if price_protection}}Protección de precios hasta {{price_protection_end}}{{/if}}

## 4. Nivel de Servicio (SLA)

### 4.1 Disponibilidad Garantizada
- **Uptime**: {{sla_percentage}}% mensual
- **Tiempo de Respuesta**: < {{response_time}}ms (promedio)
- **Mantenimiento Programado**: < {{maintenance_hours}} horas/mes

### 4.2 Créditos por Incumplimiento
{{#each sla_credits}}
- {{threshold_min}}% - {{threshold_max}}%: {{credit_percent}}% de crédito
{{/each}}

### 4.3 Soporte Técnico
- **P1 (Crítico)**: {{support_p1_response}} (24/7)
- **P2 (Alto)**: {{support_p2_response}} (horario laboral)
- **P3 (Medio)**: {{support_p3_response}} (horario laboral)

## 5. Protección de Datos y Privacidad

### 5.1 Roles de Datos
- **{{client_company}}**: Responsable del Tratamiento
- **{{company_name}}**: Encargado del Tratamiento

### 5.2 Finalidades Autorizadas
- Ejecución de workflows automatizados
- Almacenamiento y procesamiento de datos empresariales
- Análisis de uso para optimización del servicio
- Generación de reportes y métricas

### 5.3 Medidas de Seguridad
- Cifrado AES-256 en reposo y TLS 1.3 en tránsito
- Autenticación multifactor obligatoria
- Certificación {{security_certifications}}
- Auditorías de seguridad {{audit_frequency}}

### 5.4 Transferencias Internacionales
- Transferencias autorizadas a: {{authorized_countries}}
- Mecanismos de protección: {{transfer_safeguards}}
- Lista de subprocesadores en: {{subprocessors_url}}

## 6. Propiedad Intelectual

### 6.1 Propiedad del Cliente
- Todos los datos ingresados por el Cliente
- Workflows y configuraciones personalizadas
- Resultados y outputs generados

### 6.2 Propiedad del Proveedor
- Plataforma {{company_name}} y tecnología subyacente
- Plantillas genéricas y mejores prácticas
- Conocimientos y metodologías desarrolladas

### 6.3 Uso de Datos Agregados
{{#if aggregated_data_allowed}}
- {{company_name}} puede usar datos agregados y anonimizados para mejoras del producto
- No se incluirán datos que identifiquen específicamente al Cliente
{{else}}
- Prohibido el uso de datos del Cliente para cualquier propósito distinto al servicio
{{/if}}

## 7. Confidencialidad

### 7.1 Información Confidencial
Incluye pero no se limita a:
- Datos empresariales y de clientes
- Procesos internos y metodologías
- Información financiera y comercial
- Planes estratégicos y de producto

### 7.2 Obligaciones
- Uso únicamente para cumplimiento del contrato
- No divulgación a terceros sin autorización
- Protección con el mismo cuidado que información propia
- Devolución o destrucción al finalizar el contrato

## 8. Limitación de Responsabilidad

### 8.1 Limitación General
La responsabilidad total de {{company_name}} se limita a {{liability_cap}} o el monto pagado en los últimos {{liability_period}} meses, lo que sea mayor.

### 8.2 Exclusiones
{{company_name}} no será responsable por:
- Daños indirectos, consecuenciales o lucro cesante
- Pérdida de datos por acciones del Cliente
- Fallas en sistemas de terceros o del Cliente
- Casos de fuerza mayor

### 8.3 Excepciones
La limitación no aplica para:
- Violaciones de confidencialidad: hasta {{confidentiality_liability}}
- Violaciones de datos personales: hasta {{data_breach_liability}}
- Actos dolosos o negligencia grave

## 9. Término y Terminación

### 9.1 Vigencia
- **Duración Inicial**: {{initial_term}}
- **Renovación**: Automática por períodos de {{renewal_term}}
- **Aviso de No Renovación**: {{non_renewal_notice}} días

### 9.2 Terminación por Conveniencia
{{#if termination_for_convenience}}
- Cualquier parte puede terminar con {{termination_notice}} días de aviso
- Sin penalidades por terminación anticipada
{{else}}
- Terminación solo por incumplimiento material
- Período de subsanación de {{cure_period}} días
{{/if}}

### 9.3 Obligaciones Post-Terminación
- Devolución de información confidencial
- Migración de datos por {{data_migration_period}} días
- Eliminación segura tras período de transición

## 10. Resolución de Disputas

### 10.1 Escalamiento
1. **Gerentes de Cuenta**: Resolución en {{escalation_l1}} días
2. **Directores**: Resolución en {{escalation_l2}} días  
3. **Mediación**: A través de {{mediation_body}}

### 10.2 Arbitraje
- Arbitraje vinculante bajo reglas de {{arbitration_rules}}
- Sede: {{arbitration_venue}}
- Idioma: {{arbitration_language}}
- Costos divididos entre las partes

### 10.3 Ley Aplicable
- Ley sustantiva de {{governing_law}}
- Tribunales de {{court_jurisdiction}} como respaldo

## 11. Disposiciones Generales

### 11.1 Modificaciones
- Cambios requieren acuerdo escrito firmado por ambas partes
- {{company_name}} puede actualizar términos técnicos con {{technical_notice}} días de aviso

### 11.2 Cumplimiento Normativo
- Cumplimiento con {{applicable_regulations}}
- Notificación inmediata de cambios regulatorios relevantes
- Cooperación en auditorías de compliance

### 11.3 Contactos del Contrato
**Por {{company_name}}:**
- **Gerente de Cuenta**: {{account_manager}}
- **Email**: {{am_email}}
- **Teléfono**: {{am_phone}}

**Por {{client_company}}:**
- **Contacto Principal**: {{client_contact}}
- **Email**: {{client_email}}
- **Teléfono**: {{client_phone}}

## 12. Anexos

- **Anexo A**: Especificaciones Técnicas
- **Anexo B**: Lista de Subprocesadores
- **Anexo C**: Medidas de Seguridad Detalladas
- **Anexo D**: Acuerdo de Procesamiento de Datos (DPA)

---

**Firmas:**

**{{company_name}}**  
Nombre: {{company_signatory}}  
Título: {{company_title}}  
Fecha: _______________  
Firma: _______________

**{{client_company}}**  
Nombre: {{client_signatory}}  
Título: {{client_title}}  
Fecha: _______________  
Firma: _______________

---

**Información del Documento:**
- **ID del Contrato**: {{contract_id}}
- **Versión**: {{version}}
- **Generado**: {{generation_date}}
- **Hash**: {{document_hash}}

*Este Acuerdo Marco de Servicios es efectivo desde {{effective_date}} y reemplaza todos los acuerdos anteriores entre las partes para el objeto aquí definido.*