/**
 * Direct Template Population (Bypass table creation)
 * Assumes templates table already exists
 * Run: node scripts/populate-templates-direct.js
 */

const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Simplified templates data (just names, we'll add full workflows later)
const basicTemplates = [
  {
    name: "Email Notification System",
    description: "Simple email notifications for workflow events with customizable templates and recipient management",
    category: "notifications",
    subcategory: null,
    workflow_json: {
      nodes: [
        { name: "Trigger", type: "n8n-nodes-base.webhook", position: [250, 300] },
        { name: "Send Email", type: "n8n-nodes-base.emailSend", position: [450, 300] }
      ],
      connections: {
        "Trigger": { main: [[{ node: "Send Email", type: "main", index: 0 }]] }
      }
    },
    icon_url: null,
    preview_images: [],
    tags: ['email', 'notification', 'webhook'],
    difficulty: 'beginner',
    estimated_time: 10,
    price: 0,
    install_count: 0,
    rating: 4.8,
    is_featured: true,
    is_active: true
  },
  {
    name: "Slack Integration Pro",
    description: "Advanced Slack workflow with command processing, channel management, and custom bot responses",
    category: "communication",
    subcategory: null,
    workflow_json: {
      nodes: [
        { name: "Slack Trigger", type: "n8n-nodes-base.slackTrigger", position: [250, 300] },
        { name: "Process Command", type: "n8n-nodes-base.function", position: [450, 300] },
        { name: "Reply", type: "n8n-nodes-base.slack", position: [650, 300] }
      ],
      connections: {
        "Slack Trigger": { main: [[{ node: "Process Command", type: "main", index: 0 }]] },
        "Process Command": { main: [[{ node: "Reply", type: "main", index: 0 }]] }
      }
    },
    icon_url: null,
    preview_images: [],
    tags: ['slack', 'communication', 'bot'],
    difficulty: 'intermediate',
    estimated_time: 20,
    price: 0,
    install_count: 0,
    rating: 4.6,
    is_featured: true,
    is_active: true
  }
]

const premiumTemplates = [
  {
    name: "Multi-Channel Inventory Sync Pro",
    description: "Advanced inventory synchronization across Shopify, Amazon, eBay, and WooCommerce with conflict resolution",
    category: "E-commerce",
    subcategory: "Inventory Management",
    workflow_json: { nodes: [], connections: {} }, // Simplified for now
    icon_url: null,
    preview_images: [],
    tags: ["multi-channel", "inventory", "sync", "e-commerce", "pro"],
    difficulty: "advanced",
    estimated_time: 45,
    price: 25,
    install_count: 0,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  {
    name: "Advanced Customer Segmentation AI",
    description: "ML-powered customer segmentation using RFM analysis and predictive modeling for targeted campaigns",
    category: "E-commerce",
    subcategory: "Customer Analytics",
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ["ai", "customer-segmentation", "rfm", "analytics", "ml"],
    difficulty: "advanced",
    estimated_time: 60,
    price: 35,
    install_count: 0,
    rating: 4.8,
    is_featured: true,
    is_active: true
  },
  {
    name: "Advanced Lead Scoring AI Pro",
    description: "Machine learning-powered lead qualification with 50+ data points and behavioral analysis",
    category: "CRM & Sales",
    subcategory: "Lead Management",
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ["ai", "lead-scoring", "ml", "crm", "enterprise"],
    difficulty: "advanced",
    estimated_time: 75,
    price: 50,
    install_count: 0,
    rating: 4.9,
    is_featured: true,
    is_active: true
  },
  {
    name: "Cross-Platform Campaign Manager Pro",
    description: "Unified campaign management across Facebook, Google, LinkedIn Ads with ROI tracking and optimization",
    category: "Marketing",
    subcategory: "Campaign Management",
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ["cross-platform", "ads", "campaign", "marketing", "pro"],
    difficulty: "advanced",
    estimated_time: 55,
    price: 35,
    install_count: 0,
    rating: 4.7,
    is_featured: true,
    is_active: true
  },
  {
    name: "Multi-Cloud Deployment Pipeline Enterprise",
    description: "Enterprise CI/CD pipeline supporting AWS, Azure, and GCP with blue-green deployments and monitoring",
    category: "DevOps & IT",
    subcategory: "Deployment",
    workflow_json: { nodes: [], connections: {} },
    icon_url: null,
    preview_images: [],
    tags: ["multi-cloud", "cicd", "deployment", "enterprise", "devops"],
    difficulty: "advanced",
    estimated_time: 90,
    price: 50,
    install_count: 0,
    rating: 4.9,
    is_featured: true,
    is_active: true
  }
]

async function checkTableExists() {
  try {
    const { data, error } = await supabase
      .from('templates')
      .select('count', { count: 'exact', head: true })
    
    if (error) {
      console.error('❌ Templates table does not exist or is not accessible:', error.message)
      console.log('\n📝 Please create the templates table first:')
      console.log('1. Open your Supabase dashboard')
      console.log('2. Go to SQL Editor') 
      console.log('3. Run the SQL from: database/templates-schema.sql')
      return false
    }

    console.log('✅ Templates table exists and is accessible')
    return true
  } catch (error) {
    console.error('❌ Error checking table:', error)
    return false
  }
}

async function populateTemplates() {
  try {
    // Check if table exists first
    const tableExists = await checkTableExists()
    if (!tableExists) {
      return false
    }

    const allTemplates = [...basicTemplates, ...premiumTemplates]
    console.log(`📦 Inserting ${allTemplates.length} templates (${basicTemplates.length} free, ${premiumTemplates.length} premium)...`)

    // Clear existing templates first (optional)
    const { error: deleteError } = await supabase
      .from('templates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all

    if (deleteError) {
      console.log('ℹ️  Could not clear existing templates (table might be empty):', deleteError.message)
    } else {
      console.log('🧹 Cleared existing templates')
    }

    // Insert new templates
    const { data, error } = await supabase
      .from('templates')
      .insert(allTemplates)
      .select('id, name, price, category')

    if (error) {
      console.error('❌ Error inserting templates:', error)
      return false
    }

    console.log(`✅ Successfully inserted ${data.length} templates!`)
    
    // Log inserted templates
    const freeTemplates = data.filter(t => t.price === 0)
    const paidTemplates = data.filter(t => t.price > 0)

    console.log(`\n📊 Template Summary:`)
    console.log(`   🆓 Free templates: ${freeTemplates.length}`)
    console.log(`   💎 Premium templates: ${paidTemplates.length}`)
    
    if (paidTemplates.length > 0) {
      const totalRevenue = paidTemplates.reduce((sum, t) => sum + parseFloat(t.price), 0)
      console.log(`   💰 Total potential revenue: $${totalRevenue}`)
    }

    console.log(`\n📝 Inserted Templates:`)
    data.forEach(template => {
      const priceDisplay = template.price > 0 ? `$${template.price}` : 'FREE'
      console.log(`   ${template.price > 0 ? '💎' : '🆓'} ${template.name} (${template.category}) - ${priceDisplay}`)
    })

    return true

  } catch (error) {
    console.error('❌ Fatal error:', error)
    return false
  }
}

// Run the population
console.log('🚀 Starting direct template population...')

populateTemplates()
  .then((success) => {
    if (success) {
      console.log('\n🎉 Template population completed successfully!')
      console.log('\n📋 Next Steps:')
      console.log('1. Test the templates API: GET /api/templates')
      console.log('2. View templates in your app: /templates')
      console.log('3. Test template installation workflow')
    } else {
      console.log('\n❌ Template population failed')
      console.log('Please check the errors above and ensure the database is properly set up')
    }
    process.exit(success ? 0 : 1)
  })
  .catch((error) => {
    console.error('💥 Population script failed:', error)
    process.exit(1)
  })