# Push notification PWA

A static PWA subscribes devices to Web Push. Vercel serverless functions store subscriptions in Upstash Redis and send notifications with VAPID. The sender API requires a bearer token; keep that token and the VAPID private key on the server.

## Configure

1. Use Node.js 20 or newer and install dependencies with `npm install`. To run locally, install the Vercel CLI and run `vercel dev`.
2. Create an Upstash Redis database and copy its REST URL and token.
3. Generate a VAPID key pair with `npm run generate-vapid-keys`.
4. Copy `.env.example` to `.env.local` and set all six values. Use the generated public and private keys and a contact address for `VAPID_SUBJECT`. Generate a long random value for `PUSH_API_TOKEN`.
5. Run locally with `npm run dev`, or add the same environment variables to the Vercel project and deploy.

The app must be served over HTTPS outside localhost. A device's browser must support the Push API and grant notification permission. Push delivery is subject to browser and push-service policies.

Run the input validation tests with `npm test`.
After changing the app icon, remove the existing home-screen installation and install it again so the browser refreshes its cached icon.

## Send a notification

Use the **Send a notification** form in the app. Enter `PUSH_API_TOKEN` when prompted; the form sends it with the request and does not save it. The API key is still visible to the person entering it, so only use the sender form on a device you trust.

Alternatively, call the protected endpoint from a trusted server or terminal:

```sh
curl --request POST "$APP_URL/api/send" \
  --header "Authorization: Bearer $PUSH_API_TOKEN" \
  --header "Content-Type: application/json" \
  --data '{"title":"Hello","body":"A push notification","url":"/"}'
```

`url` must be a same-origin path (for example `/updates`). The response reports sent, expired/removed, and failed subscription counts. Expired subscriptions are removed automatically.

## Endpoints

- `GET /api/vapid-public-key` — returns the public VAPID key.
- `POST /api/subscribe` — stores a supported browser subscription.
- `POST /api/send` — sends a notification to stored subscriptions; requires `Authorization: Bearer <PUSH_API_TOKEN>`.
