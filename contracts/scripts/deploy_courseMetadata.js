const { Server, Networks, TransactionBuilder, BASE_FEE, Asset } = require('stellar-sdk');
const { readFile } = require('fs/promises');
const { join } = require('path');

// Configuration
const NETWORK = process.env.NETWORK || 'testnet';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'SBK2VIY4QZJ7K4G5YPVPBZC5QJ6K5E5FQJQY4Q5QJ6K5E5FQJQY4Q5QJ6K5E5FQJQY4Q';

// Network configuration
const getServer = () => {
  switch (NETWORK) {
    case 'mainnet':
      return new Server('https://horizon.stellar.org');
    case 'testnet':
      return new Server('https://horizon-testnet.stellar.org');
    default:
      throw new Error(`Unknown network: ${NETWORK}`);
  }
};

const getNetworkPassphrase = () => {
  switch (NETWORK) {
    case 'mainnet':
      return Networks.PUBLIC;
    case 'testnet':
      return Networks.TESTNET;
    default:
      throw new Error(`Unknown network: ${NETWORK}`);
  }
};

// Deploy contract function
async function deployContract() {
  console.log(`🚀 Deploying Course Metadata Contract to ${NETWORK}...`);
  
  try {
    const server = getServer();
    const networkPassphrase = getNetworkPassphrase();
    
    // Load the compiled contract
    const contractCode = await readFile(
      join(__dirname, '..', 'target', 'wasm32-unknown-unknown', 'release', 'starked_education_contracts.wasm')
    );
    
    // Create admin keypair from secret
    const adminKeypair = StellarSdk.Keypair.fromSecret(ADMIN_SECRET);
    const adminPublicKey = adminKeypair.publicKey();
    
    console.log(`📋 Admin Account: ${adminPublicKey}`);
    
    // Get admin account info
    const adminAccount = await server.loadAccount(adminPublicKey);
    console.log(`💰 Admin Account Balance: ${adminAccount.balances.map(b => `${b.asset_code || 'XLM'}: ${b.balance}`).join(', ')}`);
    
    // Build transaction to deploy contract
    const contractTransaction = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .setTimeout(30)
      .appendOperation({
        type: 'createCustomContract',
        source: adminPublicKey,
        wasmHash: StellarSdk.hash(contractCode),
      })
      .build();
    
    // Sign transaction
    contractTransaction.sign(adminKeypair);
    
    // Submit transaction
    console.log('📤 Submitting deployment transaction...');
    const result = await server.submitTransaction(contractTransaction);
    
    if (result.successful) {
      const contractId = StellarSdk.getContractId(result.hash);
      console.log(`✅ Contract deployed successfully!`);
      console.log(`📄 Contract ID: ${contractId}`);
      console.log(`🔗 Transaction Hash: ${result.hash}`);
      
      // Initialize the contract
      console.log('🔧 Initializing contract...');
      await initializeContract(server, contractId, adminKeypair, networkPassphrase);
      
      // Store contract info for easy access
      const contractInfo = {
        network: NETWORK,
        contractId: contractId,
        admin: adminPublicKey,
        deployedAt: new Date().toISOString(),
        transactionHash: result.hash,
      };
      
      console.log('💾 Contract deployment info:', JSON.stringify(contractInfo, null, 2));
      
      // Test basic functionality
      console.log('🧪 Testing contract functionality...');
      await testContract(server, contractId, adminKeypair, networkPassphrase);
      
    } else {
      console.error('❌ Deployment failed:', result);
      throw new Error('Contract deployment failed');
    }
    
  } catch (error) {
    console.error('❌ Deployment error:', error);
    process.exit(1);
  }
}

// Initialize contract function
async function initializeContract(server, contractId, adminKeypair, networkPassphrase) {
  try {
    const adminAccount = await server.loadAccount(adminKeypair.publicKey());
    
    const initTransaction = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .setTimeout(30)
      .appendOperation({
        type: 'invokeContractFunction',
        contract: contractId,
        function: 'initialize',
        args: [
          new StellarSdk.Address(adminKeypair.publicKey()).toScVal(),
        ],
      })
      .build();
    
    initTransaction.sign(adminKeypair);
    
    const result = await server.submitTransaction(initTransaction);
    
    if (result.successful) {
      console.log('✅ Contract initialized successfully!');
    } else {
      console.error('❌ Contract initialization failed:', result);
      throw new Error('Contract initialization failed');
    }
  } catch (error) {
    console.error('❌ Initialization error:', error);
    throw error;
  }
}

// Test contract functionality
async function testContract(server, contractId, adminKeypair, networkPassphrase) {
  try {
    console.log('📚 Creating test course...');
    
    const adminAccount = await server.loadAccount(adminKeypair.publicKey());
    
    // Test course creation
    const createCourseTransaction = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .setTimeout(30)
      .appendOperation({
        type: 'invokeContractFunction',
        contract: contractId,
        function: 'create_course',
        args: [
          new StellarSdk.Address(adminKeypair.publicKey()).toScVal(), // instructor
          new StellarSdk.ScString('Introduction to Stellar Development').toScVal(), // title
          new StellarSdk.ScString('Learn to build smart contracts on Stellar').toScVal(), // description
          new StellarSdk.ScString('Blockchain').toScVal(), // category
          new StellarSdk.ScString('beginner').toScVal(), // level
          new StellarSdk.ScUint(40).toScVal(), // duration (hours)
          new StellarSdk.ScUint(10000000).toScVal(), // price (stroops)
          new StellarSdk.ScArray([]).toScVal(), // prerequisites
          new StellarSdk.ScArray([
            new StellarSdk.ScString('Understand Stellar basics').toScVal(),
            new StellarSdk.ScString('Build smart contracts').toScVal(),
          ]).toScVal(), // learning objectives
          new StellarSdk.ScString('QmTestHash123').toScVal(), // syllabus (IPFS hash)
          new StellarSdk.ScString('https://example.com/course-thumb.jpg').toScVal(), // thumbnail
          new StellarSdk.ScArray([
            new StellarSdk.ScString('stellar').toScVal(),
            new StellarSdk.ScString('blockchain').toScVal(),
          ]).toScVal(), // tags
          new StellarSdk.ScString('English').toScVal(), // language
          new StellarSdk.ScBool(true).toScVal(), // certificate enabled
          new StellarSdk.ScUint(100).toScVal(), // max students
        ],
      })
      .build();
    
    createCourseTransaction.sign(adminKeypair);
    
    const createResult = await server.submitTransaction(createCourseTransaction);
    
    if (createResult.successful) {
      console.log('✅ Test course created successfully!');
      
      // Extract course ID from result (this would need proper parsing)
      const courseId = 'course_1'; // Simplified for demo
      
      // Test course retrieval
      console.log('📖 Retrieving test course...');
      await testGetCourse(server, contractId, adminKeypair, networkPassphrase, courseId);
      
      // Test course verification
      console.log('🔍 Verifying test course...');
      await testVerifyCourse(server, contractId, adminKeypair, networkPassphrase, courseId);
      
    } else {
      console.error('❌ Test course creation failed:', createResult);
    }
    
  } catch (error) {
    console.error('❌ Contract testing error:', error);
  }
}

// Test get_course function
async function testGetCourse(server, contractId, adminKeypair, networkPassphrase, courseId) {
  try {
    const adminAccount = await server.loadAccount(adminKeypair.publicKey());
    
    const getCourseTransaction = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .setTimeout(30)
      .appendOperation({
        type: 'invokeContractFunction',
        contract: contractId,
        function: 'get_course',
        args: [
          new StellarSdk.ScString(courseId).toScVal(),
        ],
      })
      .build();
    
    getCourseTransaction.sign(adminKeypair);
    
    const result = await server.submitTransaction(getCourseTransaction);
    
    if (result.successful) {
      console.log('✅ Course retrieved successfully!');
      console.log('📊 Course data available');
    } else {
      console.error('❌ Course retrieval failed:', result);
    }
  } catch (error) {
    console.error('❌ Get course test error:', error);
  }
}

// Test verify_course function
async function testVerifyCourse(server, contractId, adminKeypair, networkPassphrase, courseId) {
  try {
    const adminAccount = await server.loadAccount(adminKeypair.publicKey());
    
    const verifyTransaction = new TransactionBuilder(adminAccount, {
      fee: BASE_FEE,
      networkPassphrase,
    })
      .setTimeout(30)
      .appendOperation({
        type: 'invokeContractFunction',
        contract: contractId,
        function: 'verify_course',
        args: [
          new StellarSdk.ScString(courseId).toScVal(),
        ],
      })
      .build();
    
    verifyTransaction.sign(adminKeypair);
    
    const result = await server.submitTransaction(verifyTransaction);
    
    if (result.successful) {
      console.log('✅ Course verification successful!');
    } else {
      console.error('❌ Course verification failed:', result);
    }
  } catch (error) {
    console.error('❌ Verify course test error:', error);
  }
}

// Helper function to fund account if needed
async function fundAccountIfNeeded(server, publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    console.log(`✅ Account ${publicKey} exists and is funded`);
    return account;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`💰 Funding account ${publicKey}...`);
      
      // For testnet, you can use the friendbot
      if (NETWORK === 'testnet') {
        const response = await fetch(`https://friendbot.stellar.org/?addr=${publicKey}`);
        if (response.ok) {
          console.log('✅ Account funded successfully!');
          return await server.loadAccount(publicKey);
        }
      }
    }
    throw error;
  }
}

// Main execution
async function main() {
  console.log('🎓 StarkEd Course Metadata Contract Deployment');
  console.log('==========================================');
  
  // Validate environment
  if (!ADMIN_SECRET) {
    console.error('❌ ADMIN_SECRET environment variable is required');
    process.exit(1);
  }
  
  try {
    // Check if contract file exists
    const contractPath = join(__dirname, '..', 'target', 'wasm32-unknown-unknown', 'release', 'starked_education_contracts.wasm');
    try {
      await readFile(contractPath);
    } catch (error) {
      console.error('❌ Contract file not found. Please build the contract first:');
      console.error('   cd contracts && cargo build --target wasm32-unknown-unknown --release');
      process.exit(1);
    }
    
    // Deploy the contract
    await deployContract();
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('1. Save the contract ID for your application');
    console.log('2. Update your frontend/backend to use the new contract');
    console.log('3. Test the contract functionality');
    
  } catch (error) {
    console.error('\n❌ Deployment failed:', error.message);
    process.exit(1);
  }
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Run the deployment
if (require.main === module) {
  main();
}

module.exports = {
  deployContract,
  initializeContract,
  testContract,
};
