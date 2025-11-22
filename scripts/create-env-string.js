#!/usr/bin/env node

/**
 * Helper script to convert Firebase Service Account JSON to environment variable format
 * Usage: node scripts/create-env-string.js [path/to/serviceAccountKey.json]
 */

const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.argv[2] || './serviceAccountKey.json';

// Check if file exists
if (!fs.existsSync(serviceAccountPath)) {
  console.error('\n❌ Error: File not found:', serviceAccountPath);
  console.log('\nUsage: node scripts/create-env-string.js [path/to/serviceAccountKey.json]');
  console.log('\nExample:');
  console.log('  node scripts/create-env-string.js ./serviceAccountKey.json');
  console.log('  node scripts/create-env-string.js ~/Downloads/your-project-firebase-adminsdk.json\n');
  process.exit(1);
}

try {
  // Read and parse JSON file
  const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
  
  // Convert to single-line JSON string
  const jsonString = JSON.stringify(serviceAccount);
  
  // Display results
  console.log('\n' + '='.repeat(60));
  console.log('✅ Firebase Service Account JSON converted successfully!');
  console.log('='.repeat(60) + '\n');
  
  console.log('📋 Environment Variable Name:');
  console.log('   FIREBASE_SERVICE_ACCOUNT\n');
  
  console.log('📋 Environment Variable Value (copy this):');
  console.log('─'.repeat(60));
  console.log(jsonString);
  console.log('─'.repeat(60) + '\n');
  
  console.log('📋 Next Steps:');
  console.log('   1. Copy the JSON string above');
  console.log('   2. Go to Vercel Dashboard → Your Project → Settings → Environment Variables');
  console.log('   3. Click "Add New"');
  console.log('   4. Name: FIREBASE_SERVICE_ACCOUNT');
  console.log('   5. Value: Paste the JSON string');
  console.log('   6. Environment: Select all (Production, Preview, Development)');
  console.log('   7. Click "Save"');
  console.log('   8. Redeploy your application in Vercel');
  console.log('\n📖 For detailed instructions, see: VERCEL-FIREBASE-ADMIN-SETUP.md\n');
  
  // Optionally save to file
  const outputPath = './firebase-service-account-env.txt';
  fs.writeFileSync(outputPath, jsonString, 'utf8');
  console.log(`💾 Also saved to: ${outputPath}`);
  console.log('   (You can open this file to copy the value)\n');
  
} catch (error) {
  console.error('\n❌ Error processing JSON file:');
  console.error('   ' + error.message + '\n');
  
  if (error.message.includes('Unexpected token')) {
    console.error('⚠️  The file might not be valid JSON.');
    console.error('   Make sure you downloaded the correct service account key from Firebase Console.\n');
  }
  
  process.exit(1);
}

