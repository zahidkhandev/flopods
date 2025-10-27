const { DynamoDBClient, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const endpoint = process.env.AWS_DYNAMODB_ENDPOINT || 'http://localhost:8003';

const client = new DynamoDBClient({
  region: 'ap-south-1',
  endpoint: endpoint,
  credentials: {
    accessKeyId: 'fakeAccessKeyId123',
    secretAccessKey: 'fakeSecretAccessKey123',
  },
  requestHandler: {
    connectionTimeout: 3000, // 3 second timeout
    socketTimeout: 3000,
  },
});

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function testDynamoDB(retries = 5) {
  console.log(`🔍 Testing DynamoDB Local at ${endpoint}...\n`);

  for (let i = 1; i <= retries; i++) {
    try {
      const listResponse = await client.send(new ListTablesCommand({}));
      console.log('✅ DynamoDB Local is running!');
      console.log('📋 Existing tables:', listResponse.TableNames?.length || 0);

      if (listResponse.TableNames && listResponse.TableNames.length > 0) {
        console.log('   Tables:', listResponse.TableNames.join(', '));
      } else {
        console.log('   No tables yet (will be created when backend starts)');
      }

      console.log('\n✅ Connection test passed!');
      process.exit(0);
    } catch (error) {
      if (i === retries) {
        console.error('❌ Error connecting to DynamoDB Local after ' + retries + ' attempts:');
        console.error('   Message:', error.message);
        console.error('   Code:', error.code || 'N/A');
        console.error(`\n💡 Endpoint: ${endpoint}`);
        console.error('   DynamoDB Local is running but may still be initializing');
        console.error('   Wait a few seconds and try again, or check port mapping');
        console.error('\nDocker logs:');
        console.error('   docker logs actopod-dynamodb-local');
        process.exit(1);
      }

      console.log(`⏳ Attempt ${i}/${retries} failed, retrying in 2 seconds...`);
      await sleep(2000);
    }
  }
}

testDynamoDB();
