# Deployment Guide: Crazzzy.in Backend

Since we have moved to a **TypeScript + Prisma + Supabase** stack, we recommend modern hosting instead of traditional Cpanel.

## 1. Database (Supabase)
1.  Log into your [Supabase Dashboard](https://app.supabase.com/).
2.  Go to **Project Settings > Database**.
3.  Copy the **Connection String** (URI).
4.  Ensure your IP address is allowed in the Supabase Firewall or use `0.0.0.0/0` for initial setup.

## 2. Hosting (Railway / Render / Vercel)
We recommend **Railway** for ease of use with Node.js and Prisma.

### Steps:
1.  **GitHub**: Push your code to a private GitHub repository.
2.  **Connect**: Link your GitHub repo to Railway/Render.
3.  **Variables**: Copy all values from your `.env` file into the "Variables" section of your hosting provider.
4.  **Build Command**: `npm run build`
5.  **Start Command**: `npm start`

## 3. Prisma Production Sync
During deployment, your hosting provider needs to "generate" the Prisma client. 
Ensure your `package.json` includes:
```json
"scripts": {
  "postinstall": "prisma generate"
}
```

## 4. Production Checklist
- [ ] Set `NODE_ENV` to `production`.
- [ ] Update `ALLOWED_ORIGINS` to your live frontend URL.
- [ ] Swap Razorpay keys to **Live Mode**.
- [ ] Use a professional SMTP provider (like Postmark, SendGrid, or a paid Gmail account).
