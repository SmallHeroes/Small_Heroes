import Replicate from 'replicate';
import { writeFile } from 'fs/promises';
import { config } from 'dotenv';

// Load from .env (not .env.local)
config({ path: '.env' });

const replicate = new Replicate();

const STYLE = "Soft watercolor children's book illustration, hand-drawn pencil texture, warm gentle lighting, delicate pastel colors, storybook page feel, emotional and tender,";

const IMAGES = [
  {
    file: 'public/Images/ExamplePage2.png',
    prompt: `${STYLE} a young boy with dark curly hair sitting on a tree branch in a magical garden at golden hour, small glowing fireflies around him, he is looking up at the sky with wonder, a small friendly fox sitting next to him on the branch, dreamy atmosphere, children's book page illustration`,
    aspect: '3:4',
  },
  {
    file: 'public/Images/HeroIllustrated.png', 
    prompt: `${STYLE} a cheerful illustrated boy about 6 years old with brown hair, wearing a yellow cape, standing confidently with hands on hips, looking at viewer with a big warm smile, sparkles and stars around him, simple light warm background fading to white on edges, character centered, full body portrait, children's book hero character, transparent edges feel`,
    aspect: '3:4',
  },
];

async function generateImage(prompt, aspect) {
  const model = 'black-forest-labs/flux-dev';
  console.log(`  Model: ${model}`);
  
  const output = await replicate.run(model, {
    input: {
      prompt,
      aspect_ratio: aspect,
      output_format: 'png',
      output_quality: 95,
      num_outputs: 1,
    },
  });

  const url = Array.isArray(output) ? output[0] : output;

  if (url && typeof url[Symbol.asyncIterator] === 'function') {
    const chunks = [];
    for await (const chunk of url) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  if (typeof url === 'string') {
    const response = await fetch(url);
    return Buffer.from(await response.arrayBuffer());
  }

  throw new Error(`Unexpected output: ${typeof url}`);
}

for (const { file, prompt, aspect } of IMAGES) {
  console.log(`\nGenerating: ${file}`);
  console.log(`  Prompt: ${prompt.substring(0, 80)}...`);
  try {
    const buf = await generateImage(prompt, aspect);
    await writeFile(file, buf);
    console.log(`  ✓ Saved (${(buf.length / 1024).toFixed(0)} KB)`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
  }
}
console.log('\nDone!');
