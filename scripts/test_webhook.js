async function test() {
  const url = process.env.APPSCRIPT_WEBHOOK_URL;
  console.log("Testing URL:", url);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: 'test@example.com',
        subject: 'Test webhook',
        htmlBody: '<p>Test</p>'
      })
    });
    
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response text:", text.substring(0, 500));
    
  } catch(e) {
    console.error("Fetch error:", e.message);
  }
}
test();
