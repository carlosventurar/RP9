# Términos de Servicio - {{company_name}}

**Versión:** {{version}}  
**Fecha de entrada en vigor:** {{effective_date}}  
**Última modificación:** {{last_modified}}  
**Jurisdicción:** {{jurisdiction}}  
**Idioma:** Español

## 1. Aceptación de los Términos

Al acceder o utilizar los servicios de {{company_name}} ("el Servicio"), usted acepta estar sujeto a estos Términos de Servicio ("Términos"). Si no está de acuerdo con alguna parte de estos términos, no podrá acceder al Servicio.

## 2. Descripción del Servicio

{{company_name}} es una plataforma de automatización empresarial que permite a las organizaciones crear, gestionar y ejecutar flujos de trabajo automatizados. El Servicio incluye:

- Herramientas de creación de flujos de trabajo
- Plantillas prediseñadas para múltiples industrias
- Integraciones con más de 400 servicios de terceros
- Análisis y reportes en tiempo real
- Soporte técnico especializado {{support_coverage}}

## 3. Cuentas de Usuario

### 3.1 Registro de Cuenta
- Debe proporcionar información precisa y actualizada durante el registro
- Es responsable de mantener la confidencialidad de sus credenciales
- Debe notificar inmediatamente cualquier uso no autorizado de su cuenta
- {{company_name}} se reserva el derecho de suspender cuentas con información falsa

### 3.2 Tipos de Cuenta
- **{{plan_starter}}**: Plan básico para equipos pequeños (hasta {{starter_users}} usuarios)
- **{{plan_pro}}**: Plan avanzado para empresas en crecimiento (hasta {{pro_users}} usuarios)  
- **{{plan_enterprise}}**: Plan personalizado para organizaciones grandes (usuarios ilimitados)

## 4. Uso Aceptable

### 4.1 Usos Permitidos
- Automatización de procesos empresariales legítimos
- Integración con sus propios sistemas y datos
- Creación de flujos de trabajo para su organización
- Compartir plantillas públicas con la comunidad (opcional)

### 4.2 Usos Prohibidos
- Actividades ilegales o que violen derechos de terceros
- Distribución de malware o contenido malicioso
- Uso excesivo que afecte el rendimiento del servicio
- Ingeniería inversa o intento de acceso no autorizado
- Reventa o redistribución del servicio sin autorización

## 5. Facturación y Pagos

### 5.1 Precios
- Los precios se establecen según el plan seleccionado
- Los precios pueden variar por región y moneda local
- Se aplicarán impuestos según corresponda por país
- Descuentos disponibles para pagos anuales

### 5.2 Facturación
- La facturación es recurrente ({{billing_cycle}})
- Los pagos se procesan automáticamente el día {{billing_day}}
- El acceso se suspende por falta de pago tras {{grace_period}} días
- Notificaciones de vencimiento se envían {{notice_days}} días antes

### 5.3 Reembolsos
- Los pagos no son reembolsables excepto por defectos del servicio
- Puede cancelar en cualquier momento (sin reembolso del período actual)
- Créditos por tiempo de inactividad según nuestro SLA del {{sla_percentage}}%

## 6. Privacidad y Seguridad

### 6.1 Protección de Datos
- Sus datos se procesan según nuestra Política de Privacidad
- Implementamos medidas de seguridad SOC2 Type II y controles CIS
- No compartimos sus datos sin su consentimiento explícito
- Cumplimos con {{data_regulations}} aplicables

### 6.2 Propiedad de los Datos
- Usted conserva la propiedad completa de sus datos
- Nos concede licencia para procesar sus datos según estos Términos
- Puede exportar sus datos en cualquier momento en formatos estándar
- Eliminación garantizada en {{data_retention}} días tras cancelación

## 7. Propiedad Intelectual

### 7.1 Propiedad del Servicio
- {{company_name}} y su tecnología son propiedad exclusiva de la empresa
- Se le otorga una licencia limitada y no transferible para usar el Servicio

### 7.2 Contenido del Usuario
- Usted conserva todos los derechos sobre sus flujos de trabajo y datos
- Nos concede licencia para alojar, procesar y entregar su contenido
- {{#if opt_out}}Puede opt-out del uso de datos agregados para mejoras{{/if}}

## 8. Disponibilidad del Servicio y SLA

### 8.1 Tiempo de Actividad
- Garantizamos {{sla_percentage}}% de disponibilidad mensual
- Exclusiones: mantenimientos programados con {{maintenance_notice}} horas de aviso
- Monitoreo 24/7 con alertas automáticas

### 8.2 Créditos por SLA
En caso de no cumplir nuestro SLA, proporcionamos créditos automáticos:
{{#each sla_penalties}}
- {{uptime_min}}% - {{uptime_max}}%: {{credit_percent}}% de crédito
{{/each}}

### 8.3 Modificaciones del Servicio
- Podemos modificar o discontinuar funciones con {{feature_notice}} días de aviso
- Los cambios importantes se notificarán por email y dashboard
- Nuevas funciones pueden incluirse sin costo adicional

## 9. Soporte y Tiempo de Respuesta

### 9.1 Niveles de Soporte
- **P1 (Crítico)**: {{support_p1}} - Servicio completamente inoperativo
- **P2 (Alto)**: {{support_p2}} - Funcionalidad principal afectada  
- **P3 (Medio)**: {{support_p3}} - Problemas menores o consultas

### 9.2 Canales de Soporte
- Portal de soporte 24/7 en {{support_url}}
- Email: {{support_email}}
- Chat en vivo: Horario laboral {{business_hours}}
- Soporte telefónico: Solo para planes Enterprise

## 10. Limitación de Responsabilidad

### 10.1 Exención de Garantías
- El servicio se proporciona "tal como está"
- No garantizamos que sea completamente libre de errores
- Su uso es bajo su propio riesgo y discreción

### 10.2 Limitación de Daños
- Nuestra responsabilidad se limita al monto pagado en los últimos {{liability_months}} meses
- Máximo de responsabilidad: {{max_liability}}
- No somos responsables de daños indirectos, consecuenciales o lucro cesante
- Excepciones: violación de datos personales o propiedad intelectual (responsabilidad de {{carveout_multiplier}}x)

## 11. Terminación

### 11.1 Terminación por su Parte
- Puede cancelar su cuenta en cualquier momento desde el dashboard
- Los datos se conservarán por {{data_retention}} días tras la cancelación
- Exportación de datos disponible durante el período de retención

### 11.2 Terminación por Nuestra Parte
{{#if plan_enterprise}}
- Solo podemos terminar contratos Enterprise por causa justificada
- Aviso previo de {{enterprise_notice}} días para terminación por causa
{{else}}
- Podemos terminar su cuenta con {{termination_notice}} días de aviso
- Terminación inmediata por violación de estos Términos
{{/if}}

## 12. Ley Aplicable y Resolución de Disputas

### 12.1 Jurisdicción
- Estos Términos se rigen por las leyes de {{jurisdiction}}
- Tribunales competentes: {{court_jurisdiction}}
- Arbitraje obligatorio a través de {{arbitration_body}}

### 12.2 Ley Aplicable por País
{{#each countries}}
- **{{name}}**: {{data_law}} - {{enforcement_agency}}
{{/each}}

### 12.3 Mediación
- Las disputas se resolverán preferentemente por mediación
- El idioma de mediación será el español
- Lugar de mediación: {{mediation_place}}

## 13. Subprocesadores y Terceros

Mantenemos una lista actualizada de subprocesadores en {{subprocessors_url}}. 
Los cambios se notifican con {{subprocessor_notice}} días de anticipación.

Principales subprocesadores:
{{#each subprocessors}}
- **{{name}}**: {{purpose}} ({{location}})
{{/each}}

## 14. Modificaciones

Podemos modificar estos Términos en cualquier momento. Los cambios importantes se notificarán:
- Por email con {{notice_period}} días de anticipación
- A través del panel de control del servicio  
- En nuestro sitio web {{website_url}}

El uso continuado después de los cambios constituye aceptación.

## 15. Contacto

Para preguntas sobre estos Términos:
- **Email Legal**: {{legal_email}}
- **Email Soporte**: {{support_email}}
- **Dirección**: {{company_address}}
- **Teléfono**: {{company_phone}}

---

**Información del Documento:**
- **ID del Documento**: {{document_id}}
- **Versión**: {{version}}
- **Idioma**: Español ({{language_code}})
- **Fecha de Generación**: {{generation_date}}
- **Hash de Integridad**: {{document_hash}}

*Estos Términos de Servicio son efectivos a partir del {{effective_date}} y reemplazan todas las versiones anteriores.*