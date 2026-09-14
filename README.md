# SyncGen — Deployment Guide

This folder is your complete SyncGen app, ready to publish.

## EASIEST WAY TO GO LIVE (recommended for beginners): Netlify Drop

You do NOT need to install anything or use a terminal.

1. Go to  https://app.netlify.com/drop  (make a free account if asked)
2. On your computer, this project must first be turned into website files.
   Because that "build" step needs a developer tool, the simplest path is:
   - Go to  https://github.com  and make a free account
   - Create a new repository, upload this whole folder to it
   - Go to  https://vercel.com , sign in with GitHub, click "New Project",
     pick this repository, click "Deploy". Vercel builds it automatically.
   - In ~2 minutes you get a live link like  syncgen.vercel.app
3. That link is your live demo. Send it to clients.

## ALTERNATIVE: Hostinger (uses hosting you already pay for)

Hostinger needs the app built into plain files first. Two options:

A) If you have Hostinger BUSINESS or CLOUD plan:
   - hPanel has a "Node.js" / "Web Apps" deploy feature that builds from GitHub.
   - Connect the GitHub repo from above; Hostinger builds and hosts it.

B) If you have SHARED (Premium) plan:
   - The app must be built elsewhere first (Vercel/Netlify do this), then the
     finished files uploaded to hPanel > File Manager > public_html.
   - Also upload the contents of public_htaccess.txt as a file named ".htaccess"
     into public_html (this fixes page navigation).

## TURNING ON THE AI BOT (later, needs a developer)

The AI analyst shows a friendly "demo mode" note until you connect a backend.
A developer creates a tiny server that holds your Anthropic API key, then pastes
that server's URL into index.html where it says  window.SYNCGEN_AI_BACKEND = "";

NEVER put your Anthropic API key directly in the website files — it would be
visible to anyone and could be stolen.

## CONNECTING REAL PLANT DATA (later, needs a developer)

The demo uses simulated numbers. To show real plants, a developer builds a
backend service that subscribes to your MQTT broker and feeds live tag values
into the app. This is the main "Phase 2" engineering work.
