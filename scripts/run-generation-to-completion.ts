/**

 * Drive a stuck/in-progress order to completion via the production worker path.

 *

 *   npx tsx --require ./scripts/shims/register-server-only.cjs scripts/run-generation-to-completion.ts <orderId>

 */

import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

loadEnv();

// Local acceptance driver owns continuation — do not compete via HTTP self-chain.
process.env.GENERATION_DISABLE_SELF_CHAIN = 'true';

import './shims/register-server-only.cjs';



async function main(): Promise<void> {

  const orderId = process.argv[2]?.trim();

  if (!orderId) {

    console.error('Usage: npx tsx scripts/run-generation-to-completion.ts <orderId>');

    process.exit(1);

  }



  const { runGenerationToCompletion } = await import('../lib/generation-chunked/run-to-completion');



  console.log(`[run-to-completion] orderId=${orderId}`);

  const result = await runGenerationToCompletion(orderId);

  console.log(JSON.stringify(result, null, 2));



  if (!result.done) {

    process.exit(1);

  }

  console.log('=== GENERATION TO COMPLETION: PASS ===');

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});


