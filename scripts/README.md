# Templates Population Script

This script populates the Supabase database with 25+ professional n8n workflow templates across 5 industries.

## Prerequisites

1. **Environment Variables**: Ensure your `.env.local` file contains:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

2. **Database Schema**: Make sure the `templates` table exists in Supabase with the correct schema.

## Usage

```bash
# Install dependencies (if not already done)
npm install

# Run the population script
npm run populate-templates
```

## What it does

The script will:

1. **Clear existing templates** (optional - can be disabled)
2. **Insert 25+ professional templates** across these categories:
   - **E-commerce** (5 templates): Order processing, inventory alerts, reviews, cart recovery, product import
   - **CRM & Sales** (5 templates): Lead scoring, pipeline automation, contact sync, meeting follow-up, sales reports  
   - **Marketing** (5 templates): Email campaigns, social media scheduling, content publishing, lead nurturing, event registration
   - **DevOps & IT** (5 templates): CI/CD notifications, server monitoring, backup automation, error processing, health checks
   - **Finance & Operations** (5 templates): Invoice processing, payment reconciliation, expense reports, budget alerts, payroll

3. **Generate summary** showing templates by category

## Template Features

Each template includes:
- **Real n8n workflow JSON** with actual nodes and connections
- **Comprehensive metadata**: name, description, category, difficulty, estimated time
- **Professional quality**: Based on production-ready workflows
- **Security sanitization**: Credentials and sensitive data are handled properly
- **Industry-specific**: Targeted solutions for common business use cases

## Template Structure

```javascript
{
  name: "Template Name",
  description: "Detailed description of what the template does",
  category: "Industry Category", 
  subcategory: "Specific Use Case",
  workflow_json: { /* Complete n8n workflow */ },
  icon_url: "URL to icon",
  tags: ["tag1", "tag2"],
  difficulty: "beginner|intermediate|advanced",
  estimated_time: 30, // minutes
  price: 0, // Free templates
  is_featured: true|false
}
```

## Output

The script provides detailed logging:
- Batch insertion progress
- Success/error counts  
- Final summary by category
- Database statistics

## Troubleshooting

- **Database connection errors**: Check your Supabase URL and service role key
- **Schema errors**: Ensure the `templates` table schema matches the expected structure
- **Memory issues**: Templates are inserted in batches of 10 to avoid memory problems

## Next Steps

After running this script:
1. Verify templates in Supabase dashboard
2. Test the `/api/templates` endpoint
3. Connect the frontend to display real templates
4. Test the template installation functionality