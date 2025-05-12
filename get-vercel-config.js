#!/usr/bin/env node

/**
 * This script helps users get their Vercel configuration details
 * for use with GitHub Actions or other deployment methods.
 */

const { execSync } = require('child_process');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n🚀 Vercel Configuration Helper\n');
console.log('This script will help you get the necessary Vercel configuration details');
console.log('for setting up GitHub Actions or other deployment methods.\n');

// Check if Vercel CLI is installed
try {
  execSync('vercel --version', { stdio: 'pipe' });
} catch (error) {
  console.log('❌ Vercel CLI is not installed. Please install it first:');
  console.log('npm install -g vercel\n');
  rl.close();
  process.exit(1);
}

// Check if user is logged in
console.log('Checking Vercel login status...');
try {
  const whoamiOutput = execSync('vercel whoami', { stdio: 'pipe' }).toString().trim();
  console.log(`✅ Logged in as: ${whoamiOutput}\n`);
  
  // Get organization ID
  console.log('Getting organization ID...');
  const orgId = execSync('vercel whoami --scope', { stdio: 'pipe' }).toString().trim();
  console.log(`✅ VERCEL_ORG_ID: ${orgId}\n`);
  
  // List projects
  console.log('Fetching projects...\n');
  const projectsOutput = execSync('vercel projects ls', { stdio: 'pipe' }).toString();
  console.log(projectsOutput);
  
  rl.question('\nEnter the name of your project to get its ID: ', (projectName) => {
    try {
      const projectInfo = execSync(`vercel project ls ${projectName}`, { stdio: 'pipe' }).toString();
      const projectIdMatch = projectInfo.match(/ID: ([a-zA-Z0-9_-]+)/);
      
      if (projectIdMatch && projectIdMatch[1]) {
        console.log(`\n✅ VERCEL_PROJECT_ID: ${projectIdMatch[1]}\n`);
      } else {
        console.log('\n❌ Could not find project ID. Please check the project name and try again.\n');
      }
      
      console.log('To get your VERCEL_TOKEN:');
      console.log('1. Go to https://vercel.com/account/tokens');
      console.log('2. Create a new token');
      console.log('3. Use that value as your VERCEL_TOKEN\n');
      
      console.log('Add these values as secrets in your GitHub repository:');
      console.log('- VERCEL_TOKEN');
      console.log('- VERCEL_ORG_ID');
      console.log('- VERCEL_PROJECT_ID\n');
      
      rl.close();
    } catch (error) {
      console.log(`\n❌ Error: ${error.message}`);
      rl.close();
    }
  });
} catch (error) {
  console.log('❌ Not logged in to Vercel. Please login first:');
  console.log('vercel login\n');
  rl.close();
} 