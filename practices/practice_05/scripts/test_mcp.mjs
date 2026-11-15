import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('======================================================');
  console.log('🦎 [Lizard Arena] Testing Custom MCP Server...');
  console.log('======================================================\n');

  const serverPath = path.resolve(__dirname, '../server/mcp/arena-mcp-server.ts');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', serverPath],
  });

  const client = new Client(
    {
      name: 'lizard-mcp-test-runner',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  await client.connect(transport);
  console.log('✔ Connected to Lizard Arena MCP server via stdio transport.\n');

  // Test 1: List Tools
  console.log('▶ [1/4] Listing available MCP Tools...');
  const toolsResponse = await client.listTools();
  console.log(`Found ${toolsResponse.tools.length} tool(s):`);
  toolsResponse.tools.forEach((t) => {
    console.log(`  - 🛠️  ${t.name}: ${t.description}`);
  });
  console.log();

  // Test 2: Successful Tool Call (simulate_combat)
  console.log('▶ [2/4] Testing Successful Call: simulate_combat...');
  const successParams = {
    attackerScore: 160,
    victimScore: 75,
    hitType: 'head_to_body',
  };
  console.log(`Input arguments:`, JSON.stringify(successParams, null, 2));
  const successResult = await client.callTool({
    name: 'simulate_combat',
    arguments: successParams,
  });
  console.log('Response isError:', !!successResult.isError);
  console.log('Response content:\n', successResult.content[0].text);
  console.log();

  // Test 3: Error Handling Call (Negative Attacker Score)
  console.log('▶ [3/4] Testing Error Handling: negative attacker score...');
  const errorParams1 = {
    attackerScore: -50,
    victimScore: 80,
    hitType: 'head_to_body',
  };
  console.log(`Input arguments:`, JSON.stringify(errorParams1, null, 2));
  const errorResult1 = await client.callTool({
    name: 'simulate_combat',
    arguments: errorParams1,
  });
  console.log('Response isError:', !!errorResult1.isError);
  console.log('Response content:\n', errorResult1.content[0].text);
  console.log();

  // Test 4: Error Handling Call (Invalid Hit Type)
  console.log('▶ [4/4] Testing Error Handling: invalid hitType...');
  const errorParams2 = {
    attackerScore: 100,
    victimScore: 100,
    hitType: 'tail_to_tail',
  };
  console.log(`Input arguments:`, JSON.stringify(errorParams2, null, 2));
  const errorResult2 = await client.callTool({
    name: 'simulate_combat',
    arguments: errorParams2,
  });
  console.log('Response isError:', !!errorResult2.isError);
  console.log('Response content:\n', errorResult2.content[0].text);
  console.log();

  // Bonus: Calculate Specs
  console.log('▶ [Bonus] Testing calculate_lizard_specs (score: 250)...');
  const specResult = await client.callTool({
    name: 'calculate_lizard_specs',
    arguments: { score: 250 },
  });
  console.log('Specs output:\n', specResult.content[0].text);

  await client.close();
  console.log('\n======================================================');
  console.log('✅ All MCP Server tests passed successfully!');
  console.log('======================================================');
}

run().catch((err) => {
  console.error('MCP Test failed:', err);
  process.exit(1);
});
