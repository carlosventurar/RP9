-- Update plans with Stripe price IDs
-- These will need to be updated with real Stripe price IDs after creating products in Stripe Dashboard

UPDATE plans SET 
  stripe_price_id = 'price_1234567890_starter', -- Replace with real Stripe price ID
  updated_at = now()
WHERE key = 'starter';

UPDATE plans SET 
  stripe_price_id = 'price_1234567890_pro', -- Replace with real Stripe price ID
  updated_at = now()
WHERE key = 'pro';

UPDATE plans SET 
  stripe_price_id = 'price_1234567890_enterprise', -- Replace with real Stripe price ID
  updated_at = now()
WHERE key = 'enterprise';

-- Note: These are placeholder price IDs. 
-- You need to:
-- 1. Create products in Stripe Dashboard (test mode)
-- 2. Create monthly recurring prices for each product
-- 3. Replace the placeholder price IDs above with real ones
-- 4. Run this migration in Supabase

-- Example of what real Stripe price IDs look like:
-- price_1P7QbABc7Cx0123456789 (starter - $19/month)
-- price_1P7QbBBc7Cx0987654321 (pro - $49/month)  
-- price_1P7QbCBc7Cx0555555555 (enterprise - $199/month)