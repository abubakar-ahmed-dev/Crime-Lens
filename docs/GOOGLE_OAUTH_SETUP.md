# Google OAuth Setup Guide

This guide explains how to configure Google OAuth for your CrimeLens application.

## Overview

The CrimeLens application uses Google OAuth 2.0 for citizen authentication via Supabase. When users click "Continue with Google" or "Sign Up with Google", they are redirected to Google's authentication page and then back to your application.

## Prerequisites

1. A Google Cloud Project with Google+ API enabled
2. Supabase project configured with Google OAuth
3. Your application running on a specific domain/port

## Google Cloud Console Configuration

### Step 1: Get your Supabase URL

Your Supabase URL is: `https://jgxizgpxxdawcgdxrlfe.supabase.co`

### Step 2: Configure Redirect URIs in Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **APIs & Services** → **Credentials**
4. Find your OAuth 2.0 Client ID (create one if it doesn't exist)
5. Click on the client ID to edit it

### Step 3: Add Authorized Redirect URIs

You need to add the following URIs to your OAuth 2.0 client:

#### For Local Development:
```
http://localhost:5173/auth/callback
```

#### For Production (replace with your actual domain):
```
https://yourdomain.com/auth/callback
```

#### Supabase Production URL (already configured by Supabase):
```
https://jgxizgpxxdawcgdxrlfe.supabase.co/auth/v1/callback
```

**Important:** The error `redirect_uri_mismatch` occurs when Google receives a redirect URI that doesn't match what's configured in your Google Cloud Console.

### Step 4: Configure Supabase

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigate to **Authentication** → **Providers**
3. Enable **Google** provider
4. Add your Google Client ID and Client Secret
5. Save the configuration

## Troubleshooting

### Error: "redirect_uri_mismatch"

This error means the redirect URI in the request doesn't match what's configured in Google Cloud Console.

**Solution:**
1. Check the error details for the exact `redirect_uri` being sent
2. Add that URI to your Google Cloud Console OAuth 2.0 client
3. Make sure to include both `http://localhost:5173/auth/callback` (local) and your production domain

### Error: "You can't sign in to this app because it doesn't comply with Google's OAuth 2.0 policy"

This happens when your app hasn't been verified by Google.

**Solution:**
- For development: Add test users in Google Cloud Console (OAuth consent screen → Test users)
- For production: Complete the OAuth app verification process with Google

### User is not being redirected after Google auth

1. Check that `/auth/callback` route exists in your React application
2. Verify the AuthCallback component is properly handling the OAuth response
3. Check browser console for JavaScript errors

## Flow Diagram

```
User clicks "Continue with Google"
        ↓
AuthContext calls citizenGoogleLogin()
        ↓
Supabase generates OAuth URL with redirect_uri
        ↓
User is redirected to Google OAuth page
        ↓
User approves the app
        ↓
Google redirects to: http://localhost:5173/auth/callback
        ↓
AuthCallback component handles the response
        ↓
Extracts tokens and establishes Supabase session
        ↓
Calls backend /api/citizens/google-auth
        ↓
Backend creates/updates user profile
        ↓
User redirected to appropriate page
```

## Files Modified

- `db-project-frontend/src/pages/AuthCallback/AuthCallback.tsx` - New callback handler
- `db-project-frontend/src/routes/index.tsx` - Added /auth/callback route
- `db-project-frontend/src/pages/RegisterPage/component/Register.tsx` - Added Google OAuth button
- `db-project-frontend/src/pages/CitizenLoginPage/component/CitizenLogin.tsx` - Already has Google OAuth

## Testing

1. Start your frontend: `npm run dev` (usually runs on port 5173)
2. Navigate to `/login-citizen` or `/register`
3. Click "Continue with Google" or "Sign Up with Google"
4. Complete Google authentication
5. You should be redirected back to your app and logged in
