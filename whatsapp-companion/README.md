# WhatsApp Companion Server

Since Vercel is a Serverless platform, it cannot host long-running browser processes like `whatsapp-web.js`. 

To keep automated WhatsApp messages 100% free, we use this companion Node.js server. 

## How to use locally
1. `cd whatsapp-companion`
2. `npm install`
3. `npm start`
4. Open your terminal and scan the QR code with your WhatsApp app (Linked Devices).

## How to host for free
1. Create a free account on **Render** (render.com).
2. Create a new **Web Service**.
3. Connect your GitHub repo, but set the Root Directory to `whatsapp-companion`.
4. Build command: `npm install`
5. Start command: `npm start`
6. Once deployed, check the Render logs. It will print a QR code in the logs. Scan it with your phone!
7. Finally, take your Render URL (e.g. `https://pc-v1-whatsapp.onrender.com`) and add it to Vercel Environment Variables as `WHATSAPP_COMPANION_URL`.
