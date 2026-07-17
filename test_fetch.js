require('dotenv').config({ path: '.env.local' });
const fs = require('fs');

const policy = fs.readFileSync('data/placement_policy.txt', 'utf8');

async function run() {
  console.log("Sending request to Groq... (Length:", policy.length, ")");
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are an assistant. Here is the policy:\n' + policy },
        { role: 'user', content: 'What happens if I reject an offer?' }
      ]
    })
  });
  const data = await res.json();
  if (data.error) {
    console.error("Groq Error:", data.error);
  } else {
    console.log("Response:", data.choices[0].message.content.substring(0, 100));
  }
}
run();
