# Render Backend Deployment Guide

## Overview
This guide explains how to deploy the MULTIMEDIA backend to Render.com.

## Prerequisites
- Render.com account (free tier available)
- GitHub account with the MULTIMEDIA repository
- Supabase database setup and credentials

## Deployment Steps

### 1. Connect GitHub to Render
1. Go to [render.com](https://render.com) and sign in
2. Click **"New +"** → **"Web Service"**
3. Click **"Connect a repository"**
4. Authorize GitHub and select the **MULTIMEDIA** repository
5. Click **"Connect"**

### 2. Configure Service
When Render shows the repository, configure:

- **Name:** `multimedia-learning-backend`
- **Runtime:** Node
- **Region:** Ohio (or your preferred region)
- **Branch:** main
- **Build Command:** `cd backend && npm install && npm run build`
- **Start Command:** `cd backend && npm start`
- **Plan:** Standard (free tier works for development)

### 3. Set Environment Variables
Add these environment variables in the **Environment** section:

```
NODE_ENV=production
SUPABASE_URL=<your_supabase_url>
SUPABASE_ANON_KEY=<your_supabase_anon_key>
SUPABASE_SERVICE_KEY=<your_supabase_service_key>
JWT_SECRET=<your_jwt_secret>
JWT_REFRESH_SECRET=<your_jwt_refresh_secret>
JWT_EXPIRATION=3600
JWT_REFRESH_EXPIRATION=86400
FRONTEND_URL=https://multimedia-learning.vercel.app
```

**Getting Supabase Credentials:**
1. Go to your Supabase project → Settings → API
2. Copy:
   - Project URL → `SUPABASE_URL`
   - Anon Public Key → `SUPABASE_ANON_KEY`
   - Service Role Key → `SUPABASE_SERVICE_KEY`

### 4. Deploy
1. Click **"Create Web Service"**
2. Render will automatically:
   - Build the backend (`npm run build`)
   - Start the service (`npm start`)
   - Assign a URL like `https://multimedia-learning-backend.onrender.com`

### 5. Connect Frontend to Backend
Update your frontend environment variables:

In **Vercel Dashboard**:
1. Go to multimedia-learning project → Settings → Environment Variables
2. Add: `VITE_API_URL=https://multimedia-learning-backend.onrender.com`
3. Redeploy the frontend

### 6. Update CORS
The backend automatically uses `FRONTEND_URL` for CORS. The value you set (`https://multimedia-learning.vercel.app`) is already configured.

## Post-Deployment

### Health Check
Test your backend is running:
```bash
curl https://multimedia-learning-backend.onrender.com/health
```

### View Logs
In Render dashboard:
1. Go to your service
2. Click **"Logs"** tab
3. Check for any deployment or runtime errors

### Auto-Deploy
- Any push to `main` branch automatically triggers redeployment
- Deployments take 2-5 minutes

## Troubleshooting

### Build Fails
- Check logs for errors
- Verify all dependencies are in `package.json`
- Ensure `npm run build` works locally

### Service Won't Start
- Check `NODE_ENV` is set to `production`
- Verify all environment variables are set
- Review startup logs in Render dashboard

### Database Connection Issues
- Verify Supabase credentials are correct
- Check your Supabase project is running
- Ensure JWT secrets are properly set

### CORS Errors
- Verify `FRONTEND_URL` matches your Vercel domain
- Check backend CORS middleware in `server.ts`

## Backend URL
Once deployed, your backend will be available at:
```
https://multimedia-learning-backend.onrender.com
```

Update this in your frontend environment variables if different.
