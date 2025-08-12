/**
 * Script para configurar productos y precios de Stripe para RP9 Fase 8
 * 
 * Uso:
 * 1. Instalar Stripe CLI: https://stripe.com/docs/stripe-cli
 * 2. Ejecutar: node scripts/setup-stripe-billing.js
 * 3. Copiar los price IDs generados a tu archivo .env
 */

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

const PRODUCTS_CONFIG = {
  plans: [
    {
      name: 'RP9 Starter',
      key: 'starter',
      description: 'Plan básico para empezar con automatización',
      prices: [
        { amount: 0, interval: 'month', nickname: 'Starter Monthly' }, // Gratuito
        { amount: 0, interval: 'year', nickname: 'Starter Yearly' }
      ]
    },
    {
      name: 'RP9 Pro', 
      key: 'pro',
      description: 'Plan profesional con funciones avanzadas',
      prices: [
        { amount: 2900, interval: 'month', nickname: 'Pro Monthly' }, // $29 USD
        { amount: 27840, interval: 'year', nickname: 'Pro Yearly' } // $278.40 USD (20% descuento)
      ]
    },
    {
      name: 'RP9 Enterprise',
      key: 'enterprise', 
      description: 'Plan empresarial con funciones ilimitadas',
      prices: [
        { amount: 9900, interval: 'month', nickname: 'Enterprise Monthly' }, // $99 USD
        { amount: 95040, interval: 'year', nickname: 'Enterprise Yearly' } // $950.40 USD (20% descuento)
      ]
    }
  ],
  addons: [
    {
      name: 'Pack 10K Ejecuciones',
      key: 'pack_10k',
      description: '10,000 ejecuciones adicionales',
      price: 1900 // $19 USD
    },
    {
      name: 'Pack 50K Ejecuciones', 
      key: 'pack_50k',
      description: '50,000 ejecuciones adicionales',
      price: 8900 // $89 USD
    },
    {
      name: 'Pack 100K Ejecuciones',
      key: 'pack_100k', 
      description: '100,000 ejecuciones adicionales',
      price: 16900 // $169 USD
    }
  ]
}

async function setupStripeProducts() {
  console.log('🔧 Configurando productos y precios de Stripe para RP9...\n')
  
  const results = {
    plans: {},
    addons: {},
    env_vars: []
  }

  try {
    // Crear productos de planes
    console.log('📦 Creando productos de planes...')
    for (const planConfig of PRODUCTS_CONFIG.plans) {
      console.log(`Creando producto: ${planConfig.name}`)
      
      const product = await stripe.products.create({
        name: planConfig.name,
        description: planConfig.description,
        type: 'service',
        metadata: {
          plan_key: planConfig.key,
          category: 'subscription_plan'
        }
      })

      results.plans[planConfig.key] = {
        product_id: product.id,
        prices: {}
      }

      // Crear precios para cada plan
      for (const priceConfig of planConfig.prices) {
        console.log(`  Creando precio: ${priceConfig.nickname}`)
        
        const price = await stripe.prices.create({
          product: product.id,
          unit_amount: priceConfig.amount,
          currency: 'usd',
          recurring: {
            interval: priceConfig.interval
          },
          nickname: priceConfig.nickname,
          metadata: {
            plan_key: planConfig.key,
            interval: priceConfig.interval
          }
        })

        results.plans[planConfig.key].prices[priceConfig.interval] = price.id
        
        // Generar variable de entorno
        const envVarName = `STRIPE_PRICE_${planConfig.key.toUpperCase()}${priceConfig.interval === 'year' ? '_YEARLY' : ''}`
        results.env_vars.push(`${envVarName}=${price.id}`)
      }
    }

    // Crear productos de add-ons
    console.log('\n🎁 Creando productos de add-ons...')
    for (const addonConfig of PRODUCTS_CONFIG.addons) {
      console.log(`Creando add-on: ${addonConfig.name}`)
      
      const product = await stripe.products.create({
        name: addonConfig.name,
        description: addonConfig.description,
        type: 'service',
        metadata: {
          addon_key: addonConfig.key,
          category: 'execution_pack'
        }
      })

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: addonConfig.price,
        currency: 'usd',
        metadata: {
          addon_key: addonConfig.key
        }
      })

      results.addons[addonConfig.key] = {
        product_id: product.id,
        price_id: price.id
      }

      // Generar variable de entorno
      const envVarName = `STRIPE_PRICE_${addonConfig.key.toUpperCase()}`
      results.env_vars.push(`${envVarName}=${price.id}`)
    }

    // Crear producto metered para overage (opcional)
    console.log('\n📊 Creando producto metered para overage...')
    const meteredProduct = await stripe.products.create({
      name: 'RP9 Ejecuciones Overage',
      description: 'Ejecuciones adicionales por overage',
      type: 'service',
      statement_descriptor: 'RP9 USAGE',
      metadata: {
        category: 'metered_usage'
      }
    })

    const meteredPrice = await stripe.prices.create({
      product: meteredProduct.id,
      currency: 'usd',
      recurring: {
        interval: 'month',
        usage_type: 'metered'
      },
      billing_scheme: 'per_unit',
      unit_amount_decimal: '0.2', // $0.002 por ejecución
      metadata: {
        usage_type: 'overage_executions'
      }
    })

    results.env_vars.push(`STRIPE_PRICE_METERED_EXEC=${meteredPrice.id}`)

    // Mostrar resultados
    console.log('\n✅ Configuración de Stripe completada!')
    console.log('\n📋 Productos creados:')
    console.log(JSON.stringify(results, null, 2))

    console.log('\n🔑 Variables de entorno para tu archivo .env:')
    console.log('# Stripe Billing Configuration')
    results.env_vars.forEach(envVar => console.log(envVar))

    console.log('\n📝 Próximos pasos:')
    console.log('1. Copia las variables de entorno a tu archivo .env')
    console.log('2. Configura webhook endpoints en Stripe Dashboard')
    console.log('3. Actualiza la configuración STRIPE_WEBHOOK_SECRET')
    console.log('4. Prueba el flujo de checkout en tu aplicación')

    return results

  } catch (error) {
    console.error('❌ Error configurando Stripe:', error)
    throw error
  }
}

// Script principal
if (require.main === module) {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Error: STRIPE_SECRET_KEY no encontrada en variables de entorno')
    console.log('Configura tu clave secreta de Stripe:')
    console.log('export STRIPE_SECRET_KEY=sk_test_...')
    process.exit(1)
  }

  setupStripeProducts()
    .then(() => {
      console.log('\n🎉 Setup de Stripe completado exitosamente!')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n💥 Error en setup de Stripe:', error.message)
      process.exit(1)
    })
} else {
  // Exportar para uso en otros scripts
  module.exports = { setupStripeProducts, PRODUCTS_CONFIG }
}