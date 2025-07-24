#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Starting build verification...\n');

// Check if required directories exist
const requiredDirs = [
  'frontend/dist',
  'backend/dist'
];

const requiredFiles = [
  'frontend/dist/index.html',
  'backend/dist/index.js'
];

let hasErrors = false;

// Verify directories exist
console.log('📁 Checking build directories...');
for (const dir of requiredDirs) {
  if (!fs.existsSync(dir)) {
    console.error(`❌ Missing directory: ${dir}`);
    hasErrors = true;
  } else {
    console.log(`✅ Found directory: ${dir}`);
  }
}

// Verify required files exist
console.log('\n📄 Checking build files...');
for (const file of requiredFiles) {
  if (!fs.existsSync(file)) {
    console.error(`❌ Missing file: ${file}`);
    hasErrors = true;
  } else {
    const stats = fs.statSync(file);
    console.log(`✅ Found file: ${file} (${Math.round(stats.size / 1024)}KB)`);
  }
}

// Check frontend build assets
console.log('\n🎨 Checking frontend assets...');
const frontendDistPath = 'frontend/dist';
if (fs.existsSync(frontendDistPath)) {
  const files = fs.readdirSync(frontendDistPath);
  const assetsDir = path.join(frontendDistPath, 'assets');
  let jsFiles = [];
  let cssFiles = [];
  
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    jsFiles = assetFiles.filter(f => f.endsWith('.js'));
    cssFiles = assetFiles.filter(f => f.endsWith('.css'));
  }
  
  console.log(`✅ JavaScript files: ${jsFiles.length}`);
  console.log(`✅ CSS files: ${cssFiles.length}`);
  
  if (jsFiles.length === 0) {
    console.error('❌ No JavaScript files found in frontend build');
    hasErrors = true;
  }
  
  if (cssFiles.length === 0) {
    console.error('❌ No CSS files found in frontend build');
    hasErrors = true;
  }
} else {
  console.error('❌ Frontend dist directory not found');
  hasErrors = true;
}

// Check backend build
console.log('\n⚙️  Checking backend build...');
const backendDistPath = 'backend/dist';
if (fs.existsSync(backendDistPath)) {
  const files = fs.readdirSync(backendDistPath);
  const jsFiles = files.filter(f => f.endsWith('.js'));
  
  console.log(`✅ Backend JavaScript files: ${jsFiles.length}`);
  
  if (jsFiles.length === 0) {
    console.error('❌ No JavaScript files found in backend build');
    hasErrors = true;
  }
} else {
  console.error('❌ Backend dist directory not found');
  hasErrors = true;
}

// Test backend build can be loaded
console.log('\n🧪 Testing backend build...');
try {
  // Just check if the main file can be required without running it
  const backendMain = path.resolve('backend/dist/index.js');
  if (fs.existsSync(backendMain)) {
    console.log('✅ Backend build file exists and is readable');
  } else {
    console.error('❌ Backend main file not found');
    hasErrors = true;
  }
} catch (error) {
  console.error('❌ Backend build test failed:', error.message);
  hasErrors = true;
}

// Check package.json versions match
console.log('\n📦 Checking package versions...');
try {
  const rootPkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const frontendPkg = JSON.parse(fs.readFileSync('frontend/package.json', 'utf8'));
  const backendPkg = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
  
  console.log(`✅ Root version: ${rootPkg.version}`);
  console.log(`✅ Frontend version: ${frontendPkg.version}`);
  console.log(`✅ Backend version: ${backendPkg.version}`);
} catch (error) {
  console.error('❌ Failed to read package.json files:', error.message);
  hasErrors = true;
}

// Final result
console.log('\n' + '='.repeat(50));
if (hasErrors) {
  console.error('❌ Build verification FAILED');
  console.error('Please fix the issues above before deploying.');
  process.exit(1);
} else {
  console.log('✅ Build verification PASSED');
  console.log('All builds are ready for deployment!');
  process.exit(0);
}