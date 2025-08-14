# Política de Privacidad - {{company_name}}

**Versión:** {{version}}  
**Fecha de entrada en vigor:** {{effective_date}}  
**Última modificación:** {{last_modified}}  
**Jurisdicción:** {{jurisdiction}}  
**Idioma:** Español

## 1. Información General

{{company_name}} ("nosotros", "nuestro", "la empresa") respeta su privacidad y se compromete a proteger sus datos personales. Esta Política de Privacidad explica cómo recopilamos, usamos, almacenamos y protegemos su información cuando utiliza nuestros servicios.

**Responsable del Tratamiento:** {{company_name}}  
**Dirección:** {{company_address}}  
**Email DPO:** {{dpo_email}}  
**Teléfono:** {{company_phone}}

## 2. Datos que Recopilamos

### 2.1 Datos de Identificación
- Nombre completo y apellidos
- Dirección de email profesional
- Número de teléfono empresarial
- Cargo y nombre de la empresa
- {{#if tax_collection}}Información fiscal ({{tax_id_field}} para facturación){{/if}}

### 2.2 Datos de Uso del Servicio
- Direcciones IP y geolocalización aproximada
- Información del navegador y dispositivo
- Logs de actividad en la plataforma
- Métricas de uso de workflows y integraciones
- Tiempo de sesión y patrones de navegación

### 2.3 Datos de Comunicación
- Conversaciones con soporte técnico
- Feedback y comentarios sobre el servicio
- Participación en encuestas y estudios de satisfacción
- Historial de tickets y solicitudes

### 2.4 Datos de Facturación
- Información de tarjetas de crédito (tokenizada por {{payment_processor}})
- Historial de transacciones y pagos
- Datos para facturación empresarial
- Información bancaria para devoluciones (si aplica)

### 2.5 Datos Generados por Usuarios
- Workflows y automatizaciones creadas
- Configuraciones de integraciones
- Plantillas personalizadas
- {{#unless opt_out}}Datos agregados y anonimizados para mejoras del producto{{/unless}}

## 3. Base Legal y Finalidades del Tratamiento

### 3.1 Ejecución del Contrato
- Provisión de servicios de automatización
- Gestión de cuentas de usuario
- Soporte técnico y atención al cliente
- Facturación y gestión de pagos

### 3.2 Interés Legítimo
- Mejora y desarrollo del producto
- Análisis de uso y optimización de rendimiento
- Prevención de fraude y seguridad
- Marketing directo a clientes existentes

### 3.3 Cumplimiento Legal
- Retención de registros fiscales según {{data_regulations}}
- Cooperación con autoridades competentes
- Auditorías de seguridad y compliance
- Cumplimiento de obligaciones contables

### 3.4 Consentimiento
- Newsletter y comunicaciones promocionales
- Estudios de mercado y encuestas
- Participación en programas beta
- Testimonios y casos de uso público

## 4. Compartir Datos con Terceros

### 4.1 Subprocesadores Autorizados
Compartimos datos únicamente con subprocesadores que cumplen estándares de seguridad equivalentes:

{{#each subprocessors}}
- **{{name}}** ({{location}}): {{purpose}}
  - Certificaciones: {{certifications}}
  - Datos procesados: {{data_categories}}
{{/each}}

### 4.2 Transferencias Internacionales
- Algunos subprocesadores operan fuera de {{local_region}}
- Utilizamos cláusulas contractuales estándar (SCC) de la {{data_authority}}
- Mecanismos de transferencia: {{transfer_mechanisms}}

### 4.3 Divulgación Requerida por Ley
- Orden judicial o requerimiento legal válido
- Prevención de fraude o actividad ilegal
- Protección de derechos, propiedad o seguridad

## 5. Seguridad de los Datos

### 5.1 Medidas Técnicas
- Cifrado en tránsito (TLS 1.3) y en reposo (AES-256)
- Autenticación multifactor obligatoria
- Monitoreo de seguridad 24/7
- Certificación {{security_certifications}}

### 5.2 Medidas Organizacionales
- Acceso basado en principio de menor privilegio
- Capacitación regular del personal en privacidad
- Auditorías de seguridad {{audit_frequency}}
- Plan de respuesta a incidentes documentado

### 5.3 Evaluaciones de Impacto
- DPIA realizada para procesamientos de alto riesgo
- Evaluaciones de riesgo de transferencias internacionales
- Tests de penetración {{pentest_frequency}}

## 6. Retención de Datos

### 6.1 Períodos de Retención por Tipo
- **Datos de cuenta activa**: Durante la vigencia del contrato
- **Logs de sistema**: {{logs_retention}} días
- **Datos de facturación**: {{billing_retention}} años (requisito fiscal)
- **Backups de seguridad**: {{backup_retention}} días
- **Datos de soporte**: {{support_retention}} años tras resolución

### 6.2 Eliminación Segura
- Eliminación criptográfica de datos cifrados
- Sobrescritura múltiple para datos no cifrados
- Certificados de destrucción para medios físicos
- Notificación al usuario de eliminación completada

## 7. Sus Derechos

### 7.1 Derechos Fundamentales
- **Acceso**: Obtener copia de sus datos personales
- **Rectificación**: Corregir datos incorrectos o incompletos
- **Eliminación**: Solicitar borrado bajo ciertas circunstancias
- **Restricción**: Limitar el procesamiento en casos específicos
- **Portabilidad**: Recibir datos en formato estructurado
- **Oposición**: Oponerse al procesamiento por interés legítimo

### 7.2 Ejercicio de Derechos
- **Portal de privacidad**: {{privacy_portal_url}}
- **Email**: {{privacy_email}}
- **Plazo de respuesta**: {{response_time}} días hábiles
- **Verificación de identidad**: Requerida para protección

### 7.3 Derecho de Reclamación
- Autoridad de control competente: {{data_authority}}
- Website: {{authority_url}}
- Teléfono: {{authority_phone}}

## 8. Cookies y Tecnologías de Seguimiento

### 8.1 Tipos de Cookies
- **Esenciales**: Funcionamiento básico de la plataforma
- **Funcionales**: Personalización y preferencias
- **Analíticas**: Métricas de uso y rendimiento ({{analytics_provider}})
- **Marketing**: Publicidad personalizada (con consentimiento)

### 8.2 Control de Cookies
- Configuración en {{cookie_settings_url}}
- Configuración del navegador
- Plugins de bloqueo de terceros
- Opt-out específico por proveedor

## 9. Menores de Edad

- Nuestros servicios están dirigidos a empresas y profesionales
- No recopilamos conscientemente datos de menores de {{min_age}} años
- Si detectamos datos de menores, los eliminamos inmediatamente
- Los padres pueden contactarnos en {{privacy_email}}

## 10. Cambios a esta Política

### 10.1 Notificación de Cambios
- Email con {{notice_period}} días de antelación para cambios importantes
- Notificación en el dashboard de la plataforma
- Archivo de versiones anteriores en {{policy_archive_url}}

### 10.2 Aceptación
- El uso continuado constituye aceptación de cambios menores
- Cambios sustanciales requieren consentimiento explícito
- Derecho a cancelar servicio si no acepta cambios

## 11. Contacto e Información

### 11.1 Delegado de Protección de Datos (DPO)
- **Nombre**: {{dpo_name}}
- **Email**: {{dpo_email}}
- **Dirección**: {{dpo_address}}
- **Horario**: {{dpo_hours}}

### 11.2 Información de la Empresa
- **Razón Social**: {{legal_entity_name}}
- **Registro**: {{company_registry}}
- **{{tax_id_label}}**: {{company_tax_id}}
- **Representante UE**: {{eu_representative}} (si aplica)

## 12. Normativas Aplicables

Esta política cumple con:
{{#each regulations}}
- **{{name}}** ({{jurisdiction}}): {{description}}
{{/each}}

## 13. Definiciones

- **Datos Personales**: Información que identifica o hace identificable a una persona
- **Tratamiento**: Cualquier operación realizada con datos personales
- **Responsable**: Quien determina los fines y medios del tratamiento
- **Encargado**: Quien trata datos por cuenta del responsable
- **Interesado**: Persona cuyos datos son objeto de tratamiento

---

**Información del Documento:**
- **ID del Documento**: {{document_id}}
- **Versión**: {{version}}
- **Idioma**: Español ({{language_code}})
- **Fecha de Generación**: {{generation_date}}
- **Hash de Integridad**: {{document_hash}}

**Para ejercer sus derechos o consultas sobre privacidad:**
- **Email**: {{privacy_email}}
- **Portal**: {{privacy_portal_url}}
- **Teléfono**: {{privacy_phone}}

*Esta Política de Privacidad es efectiva a partir del {{effective_date}} y reemplaza todas las versiones anteriores.*