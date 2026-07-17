require('dotenv').config({ path: '.env.local' });
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
async function run() {
  try {
    const chatCompletion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: 'Can you answer me based on placement Policy?' }],
      model: 'llama-3.3-70b-versatile',
      tools: [
        {
          type: 'function',
          function: {
            name: 'read_placement_policy',
            description: 'Read the official 2026-2027 Placement Policy document. Use this whenever the user asks about placement rules, eligibility, shortlisting, PPOs, rejecting offers, or any policy situations.',
            parameters: { type: 'object', properties: {} }
          }
        }
      ]
    });
    console.log(chatCompletion.choices[0].message);
  } catch(e) {
    console.error(e);
  }
}
run();
