const fs = require('fs');
const path = require('path');
require('dotenv').config();

console.log('🚀 Running Phase 3 Reviews and Favorites Migration...\n');

const migrationContent = fs.readFileSync(
  path.join(__dirname, '..', 'supabase', 'migrations', '003_reviews_favorites_collections.sql'),
  'utf8'
);

console.log('✅ Migration SQL loaded successfully');
console.log('📁 File size:', Math.round(migrationContent.length / 1024), 'KB');

console.log('\n📋 Migration Contents Preview:');
console.log('- Template Reviews table with RLS policies');
console.log('- Template Favorites table with sync');
console.log('- Template Collections for bundles');
console.log('- Review Helpful Votes system');
console.log('- Automatic rating calculation triggers');
console.log('- Sample collections data');

console.log('\n🔧 To apply this migration:');
console.log('1. Copy the migration SQL from the file');
console.log('2. Go to Supabase Dashboard > SQL Editor');
console.log('3. Paste and run the migration');
console.log('4. Verify tables are created successfully');

console.log('\n📊 Expected new tables:');
console.log('- template_reviews');
console.log('- template_favorites'); 
console.log('- template_collections');
console.log('- review_helpful_votes');

console.log('\n✅ New columns in templates table:');
console.log('- average_rating');
console.log('- reviews_count');
console.log('- favorites_count');

console.log('\n🎯 Ready for Phase 3 Sprint 1 features!');
console.log('Next: Run the application to test reviews system');