const { execSync } = require('child_process');
const path = require('path');

const CONTRACT_PATH = path.join(__dirname, '..');

function runCommand(command) {
  try {
    console.log(`Running: ${command}`);
    const output = execSync(command, { 
      cwd: CONTRACT_PATH, 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return output.trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`);
    console.error(error.message);
    if (error.stdout) console.log('stdout:', error.stdout);
    if (error.stderr) console.log('stderr:', error.stderr);
    process.exit(1);
  }
}

async function deploy() {
  console.log('🚀 Deploying EventLoggerContract...\n');
  
  try {
    // Check if soroban-cli is installed
    console.log('Checking soroban-cli...');
    runCommand('soroban --version');
    
    // Build the contract
    console.log('\n🔨 Building contract...');
    runCommand('cargo build --release --target wasm32-unknown-unknown');
    
    // Get the WASM file path
    const wasmPath = path.join(CONTRACT_PATH, 'target/wasm32-unknown-unknown/release/starked_education_contracts.wasm');
    
    // Check if WASM file exists
    const fs = require('fs');
    if (!fs.existsSync(wasmPath)) {
      console.error(`❌ WASM file not found at: ${wasmPath}`);
      console.log('Looking for alternative WASM files...');
      
      // Try to find the WASM file with different naming conventions
      const targetDir = path.join(CONTRACT_PATH, 'target/wasm32-unknown-unknown/release');
      const files = fs.readdirSync(targetDir);
      const wasmFiles = files.filter(file => file.endsWith('.wasm'));
      
      if (wasmFiles.length > 0) {
        console.log(`Found WASM files: ${wasmFiles.join(', ')}`);
        // Use the first one (usually the correct one)
        const wasmPathAlt = path.join(targetDir, wasmFiles[0]);
        console.log(`Using: ${wasmPathAlt}`);
        deployContract(wasmPathAlt);
      } else {
        console.error('❌ No WASM files found in target directory');
        process.exit(1);
      }
    } else {
      deployContract(wasmPath);
    }
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

function deployContract(wasmPath) {
  console.log(`\n📦 Installing WASM from: ${wasmPath}`);
  
  try {
    // Install WASM
    const installCmd = `soroban contract install --wasm ${wasmPath} --source alice --network standalone`;
    const wasmHash = runCommand(installCmd);
    console.log(`✅ WASM Hash: ${wasmHash}`);
    
    // Deploy Contract
    console.log('\n🔧 Instantiating contract...');
    const deployCmd = `soroban contract deploy --wasm-hash ${wasmHash} --source alice --network standalone`;
    const contractId = runCommand(deployCmd);
    
    console.log('\n🎉 Success! EventLoggerContract deployed at:');
    console.log(`📋 Contract ID: ${contractId}`);
    
    // Test the deployment
    console.log('\n🧪 Testing deployment...');
    testContract(contractId);
    
  } catch (error) {
    console.error('❌ Contract deployment failed:', error.message);
    process.exit(1);
  }
}

function testContract(contractId) {
  try {
    // Test initialization
    console.log('Initializing contract...');
    const initCmd = `soroban contract invoke --id ${contractId} --source alice --network standalone -- --function initialize`;
    runCommand(initCmd);
    console.log('✅ Contract initialized successfully');
    
    // Test logging a course completion event
    console.log('Testing event logging...');
    const testUser = 'GD66SGUKPFWYJKQC3436TH3NMEJDCMFVFUNJUFGJ5DY2CWOGFL6OJWRA';
    const testCourseId = 'test-course-001';
    const testMetadata = '{"test": "true"}';
    
    const logCmd = `soroban contract invoke --id ${contractId} --source alice --network standalone -- --function log_course_completion --user ${testUser} --course_id "${testCourseId}" --metadata "${testMetadata}"`;
    const eventId = runCommand(logCmd);
    console.log(`✅ Event logged successfully with ID: ${eventId}`);
    
    // Test retrieving the event
    console.log('Testing event retrieval...');
    const getEventCmd = `soroban contract invoke --id ${contractId} --source alice --network standalone -- --function get_event --event_id ${eventId}`;
    const eventDetails = runCommand(getEventCmd);
    console.log(`✅ Event details retrieved: ${eventDetails}`);
    
    // Test getting event count
    console.log('Testing event count...');
    const countCmd = `soroban contract invoke --id ${contractId} --source alice --network standalone -- --function get_event_count`;
    const eventCount = runCommand(countCmd);
    console.log(`✅ Total events: ${eventCount}`);
    
    console.log('\n✨ All tests passed! EventLoggerContract is ready for use.');
    
  } catch (error) {
    console.error('❌ Deployment test failed:', error.message);
    console.log('⚠️  The contract may still be deployed, but some functionality needs verification.');
  }
}

// Check if we're running the script directly
if (require.main === module) {
  console.log('EventLoggerContract Deployment Script');
  console.log('=====================================\n');
  
  // Validate network setup
  try {
    console.log('Checking network setup...');
    runCommand('soroban network ls');
  } catch (error) {
    console.log('Setting up standalone network...');
    try {
      runCommand('soroban network add --global --rpc-url http://localhost:8000/soroban/rpc --network-passphrase "Standalone Network ; February 2024" standalone');
    } catch (setupError) {
      console.log('Network setup may already exist, continuing...');
    }
  }
  
  // Check if standalone network is running
  console.log('\nChecking if standalone network is running...');
  try {
    runCommand('curl -s http://localhost:8000 > /dev/null');
    console.log('✅ Standalone network is running');
  } catch (error) {
    console.log('⚠️  Standalone network not detected. Please start it with:');
    console.log('   soroban network start --name standalone');
    console.log('   Or start the Stellar Quickstart container.');
    process.exit(1);
  }
  
  deploy();
}

module.exports = { deploy };