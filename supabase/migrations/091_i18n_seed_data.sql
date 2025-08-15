-- Agente Virtual IA Fase 15: Datos semilla para configuración de países LatAm
-- Insert inicial de configuraciones por país

-- Configuración de países LatAm + fallback US
insert into country_configs (
  country_code, country_name, locale, currency, timezone, currency_symbol,
  tax_mode, tax_id_label, tax_id_required, vat_rate, phone_code,
  date_format, number_format, active, meta
) values 
  -- México
  ('MX', 'México', 'es-MX', 'MXN', 'America/Mexico_City', '$',
   'gross', 'RFC', true, 16.00, '+52',
   'DD/MM/YYYY', 'es-MX', true, '{"cfdi_required": true, "sat_catalog": true}'::jsonb),
   
  -- Colombia  
  ('CO', 'Colombia', 'es-CO', 'COP', 'America/Bogota', '$',
   'gross', 'NIT', true, 19.00, '+57', 
   'DD/MM/YYYY', 'es-CO', true, '{"dian_required": true}'::jsonb),
   
  -- Chile
  ('CL', 'Chile', 'es-CL', 'CLP', 'America/Santiago', '$',
   'net', 'RUT', true, 19.00, '+56',
   'DD-MM-YYYY', 'es-CL', true, '{"sii_required": true}'::jsonb),
   
  -- Perú
  ('PE', 'Perú', 'es-PE', 'PEN', 'America/Lima', 'S/',
   'gross', 'RUC', true, 18.00, '+51',
   'DD/MM/YYYY', 'es-PE', true, '{"sunat_required": true}'::jsonb),
   
  -- Argentina
  ('AR', 'Argentina', 'es-AR', 'ARS', 'America/Argentina/Buenos_Aires', '$',
   'gross', 'CUIT', true, 21.00, '+54',
   'DD/MM/YYYY', 'es-AR', true, '{"afip_required": true, "withholding": true}'::jsonb),
   
  -- República Dominicana
  ('DO', 'República Dominicana', 'es-DO', 'DOP', 'America/Santo_Domingo', '$',
   'gross', 'RNC', false, 18.00, '+1-809',
   'DD/MM/YYYY', 'es-DO', true, '{"dgii_required": false}'::jsonb),
   
  -- Estados Unidos (fallback para USD)
  ('US', 'Estados Unidos', 'en-US', 'USD', 'America/New_York', '$',
   'net', 'SSN', false, 0.00, '+1',
   'MM/DD/YYYY', 'en-US', true, '{"sales_tax_varies": true}'::jsonb)
on conflict (country_code) do nothing;

-- Price books iniciales (precios psicológicos por país)
-- Starter Plan
insert into price_books (
  country_code, plan_id, period, currency, stripe_price_id, 
  list_price, psychological_price, discount_pct, active, meta
) values
  -- México - Starter
  ('MX', 'starter', 'monthly', 'MXN', 'price_mx_starter_monthly', 999.00, 999.00, 0, true, '{}'),
  ('MX', 'starter', 'yearly', 'MXN', 'price_mx_starter_yearly', 7992.00, 7992.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Colombia - Starter  
  ('CO', 'starter', 'monthly', 'COP', 'price_co_starter_monthly', 99000.00, 99000.00, 0, true, '{}'),
  ('CO', 'starter', 'yearly', 'COP', 'price_co_starter_yearly', 799200.00, 799000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Chile - Starter
  ('CL', 'starter', 'monthly', 'CLP', 'price_cl_starter_monthly', 19900.00, 19900.00, 0, true, '{}'),
  ('CL', 'starter', 'yearly', 'CLP', 'price_cl_starter_yearly', 159200.00, 159000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Perú - Starter
  ('PE', 'starter', 'monthly', 'PEN', 'price_pe_starter_monthly', 99.00, 99.00, 0, true, '{}'),
  ('PE', 'starter', 'yearly', 'PEN', 'price_pe_starter_yearly', 792.00, 790.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Argentina - Starter
  ('AR', 'starter', 'monthly', 'ARS', 'price_ar_starter_monthly', 9990.00, 9990.00, 0, true, '{}'),
  ('AR', 'starter', 'yearly', 'ARS', 'price_ar_starter_yearly', 79920.00, 79900.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- República Dominicana - Starter
  ('DO', 'starter', 'monthly', 'DOP', 'price_do_starter_monthly', 1499.00, 1499.00, 0, true, '{}'),
  ('DO', 'starter', 'yearly', 'DOP', 'price_do_starter_yearly', 11992.00, 11990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Estados Unidos - Starter (USD)
  ('US', 'starter', 'monthly', 'USD', 'price_us_starter_monthly', 49.00, 49.00, 0, true, '{}'),
  ('US', 'starter', 'yearly', 'USD', 'price_us_starter_yearly', 392.00, 390.00, 33.33, true, '{"savings": "4 months free"}')

on conflict (country_code, plan_id, period) do nothing;

-- Pro Plan
insert into price_books (
  country_code, plan_id, period, currency, stripe_price_id,
  list_price, psychological_price, discount_pct, active, meta  
) values
  -- México - Pro
  ('MX', 'pro', 'monthly', 'MXN', 'price_mx_pro_monthly', 1999.00, 1999.00, 0, true, '{}'),
  ('MX', 'pro', 'yearly', 'MXN', 'price_mx_pro_yearly', 15992.00, 15990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Colombia - Pro
  ('CO', 'pro', 'monthly', 'COP', 'price_co_pro_monthly', 199000.00, 199000.00, 0, true, '{}'),
  ('CO', 'pro', 'yearly', 'COP', 'price_co_pro_yearly', 1592000.00, 1590000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Chile - Pro  
  ('CL', 'pro', 'monthly', 'CLP', 'price_cl_pro_monthly', 39900.00, 39900.00, 0, true, '{}'),
  ('CL', 'pro', 'yearly', 'CLP', 'price_cl_pro_yearly', 319200.00, 319000.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Perú - Pro
  ('PE', 'pro', 'monthly', 'PEN', 'price_pe_pro_monthly', 199.00, 199.00, 0, true, '{}'),
  ('PE', 'pro', 'yearly', 'PEN', 'price_pe_pro_yearly', 1592.00, 1590.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Argentina - Pro
  ('AR', 'pro', 'monthly', 'ARS', 'price_ar_pro_monthly', 19990.00, 19990.00, 0, true, '{}'),  
  ('AR', 'pro', 'yearly', 'ARS', 'price_ar_pro_yearly', 159920.00, 159900.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- República Dominicana - Pro
  ('DO', 'pro', 'monthly', 'DOP', 'price_do_pro_monthly', 2999.00, 2999.00, 0, true, '{}'),
  ('DO', 'pro', 'yearly', 'DOP', 'price_do_pro_yearly', 23992.00, 23990.00, 33.33, true, '{"savings": "4 meses gratis"}'),
  
  -- Estados Unidos - Pro (USD)
  ('US', 'pro', 'monthly', 'USD', 'price_us_pro_monthly', 99.00, 99.00, 0, true, '{}'),
  ('US', 'pro', 'yearly', 'USD', 'price_us_pro_yearly', 792.00, 790.00, 33.33, true, '{"savings": "4 months free"}')
  
on conflict (country_code, plan_id, period) do nothing;

-- Feature flags por país (configuración inicial)
insert into country_feature_flags (
  country_code, payment_methods, billing_features, marketplace_features, 
  compliance_features, ui_features
) values 
  ('MX', '["card", "oxxo"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb, 
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "cfdi": true, "factura_global": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('CO', '["card", "pse", "bancolombia"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb, 
   '{"tax_withholding": true, "factura_electronica": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('CL', '["card", "khipu"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "boleta_electronica": true}'::jsonb, 
   '{"show_tax_breakdown": false, "tax_inclusive_pricing": false}'::jsonb),
   
  ('PE', '["card", "pagoefectivo"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": true, "factura_electronica": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('AR', '["card", "mercadopago"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": true, "factura_electronica": true, "afip_integration": true}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('DO', '["card"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": true, "local_currency": true}'::jsonb,
   '{"tax_withholding": false, "factura_electronica": false}'::jsonb,
   '{"show_tax_breakdown": true, "tax_inclusive_pricing": true}'::jsonb),
   
  ('US', '["card", "ach"]'::jsonb, '{"dunning": true, "autopay": true}'::jsonb,
   '{"local_templates": false, "local_currency": false}'::jsonb,
   '{"tax_withholding": false, "1099": false}'::jsonb,
   '{"show_tax_breakdown": false, "tax_inclusive_pricing": false}'::jsonb)
   
on conflict (country_code) do nothing;

-- Mensajes i18n básicos que no están en archivos JSON
insert into i18n_messages (locale, namespace, message_key, message_value, description, context) values
  -- Mensajes de billing específicos por país
  ('es-MX', 'billing', 'tax_id_label', 'RFC', 'Etiqueta para el campo de identificación fiscal mexicano', 'billing_form'),
  ('es-CO', 'billing', 'tax_id_label', 'NIT', 'Etiqueta para el campo de identificación fiscal colombiano', 'billing_form'), 
  ('es-CL', 'billing', 'tax_id_label', 'RUT', 'Etiqueta para el campo de identificación fiscal chileno', 'billing_form'),
  ('es-PE', 'billing', 'tax_id_label', 'RUC', 'Etiqueta para el campo de identificación fiscal peruano', 'billing_form'),
  ('es-AR', 'billing', 'tax_id_label', 'CUIT', 'Etiqueta para el campo de identificación fiscal argentino', 'billing_form'),
  ('es-DO', 'billing', 'tax_id_label', 'RNC', 'Etiqueta para el campo de identificación fiscal dominicano', 'billing_form'),
  
  -- Mensajes de moneda
  ('es-MX', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-CO', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-CL', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-PE', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-AR', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  ('es-DO', 'currency', 'toggle_usd', 'Ver en USD', 'Botón para alternar vista de precios a USD', 'pricing'),
  
  ('en-US', 'currency', 'toggle_local', 'View in local currency', 'Button to toggle to local currency view', 'pricing')
  
on conflict (locale, namespace, message_key) do nothing;