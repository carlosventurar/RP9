require('dotenv').config()
const Stripe = require('stripe')

const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

async function setupStripeProducts() {
  console.log('🔧 Setting up Stripe products and prices...')
  
  const products = [
    {
      key: 'starter',
      name: 'Plan Inicial RP9',
      description: '1,000 ejecuciones por mes, ideal para comenzar',
      price: 1900, // $19.00 in cents
      features: [
        '1,000 ejecuciones/mes',
        '10 workflows',
        '500MB storage',
        'Soporte por email'
      ]
    },
    {
      key: 'pro', 
      name: 'Plan Profesional RP9',
      description: '10,000 ejecuciones por mes, perfecto para equipos',
      price: 4900, // $49.00 in cents
      features: [
        '10,000 ejecuciones/mes',
        '50 workflows',
        '1GB storage',
        'Soporte prioritario'
      ]
    },
    {
      key: 'enterprise',
      name: 'Plan Empresarial RP9', 
      description: 'Ejecuciones ilimitadas para empresas',
      price: 19900, // $199.00 in cents
      features: [
        'Ejecuciones ilimitadas',
        'Workflows ilimitados', 
        '10GB storage',
        'Soporte 24/7'
      ]
    }
  ]

  const results = []

  for (const productData of products) {
    try {
      console.log(`Creating product: ${productData.name}`)
      
      // Create product
      const product = await stripe.products.create({
        name: productData.name,
        description: productData.description,
        metadata: {
          plan_key: productData.key,
          features: JSON.stringify(productData.features)
        }
      })

      console.log(`✅ Product created: ${product.id}`)

      // Create price
      const price = await stripe.prices.create({
        currency: 'usd',
        unit_amount: productData.price,
        recurring: {
          interval: 'month',
        },
        product: product.id,
        metadata: {
          plan_key: productData.key
        }
      })

      console.log(`✅ Price created: ${price.id}`)

      results.push({
        planKey: productData.key,
        productId: product.id,
        priceId: price.id,
        amount: productData.price / 100
      })

    } catch (error) {
      console.error(`❌ Error creating ${productData.key}:`, error.message)
    }
  }

  console.log('\n🎉 Setup complete! Here are your Stripe Price IDs:')
  console.log('Copy these to update your migration file:\n')

  results.forEach(result => {
    console.log(`${result.planKey.toUpperCase()}: ${result.priceId} ($${result.amount}/month)`)
  })

  console.log('\n📝 Next steps:')
  console.log('1. Update supabase/migrations/002_update_stripe_price_ids.sql with these real price IDs')
  console.log('2. Run the migration in Supabase')
  console.log('3. Update environment variables with STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY')
  console.log('4. Test the billing flow')

  return results
}

// Run the setup
if (require.main === module) {
  setupStripeProducts().catch(console.error)
}

module.exports = { setupStripeProducts }