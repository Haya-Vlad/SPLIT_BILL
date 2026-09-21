# TripSplit — Firebase + Vercel

This version connects the TripSplit profile button to real Google OAuth using Firebase Authentication and stores the signed-in user's profile and application state in Firestore.

## Firebase project
The supplied Firebase Web configuration points to project `split-e1675`.

## Before deployment
1. Firebase Console → Authentication → Sign-in method → Google → Enable.
2. Firebase Console → Authentication → Settings → Authorized domains → add your Vercel domain after deployment.
3. Firebase Console → Firestore → Rules → paste the contents of `firestore.rules` and Publish.
4. Deploy this folder to Vercel.

## What is connected
- Google sign-in/sign-out.
- Google display name, email, photo URL and UID become the profile identity.
- User profile is saved in `users/{uid}`.
- TripSplit app state is saved in `users/{uid}/appState/main`.
- Local browser state is retained for offline/local continuity.

## Important architecture note
The current release authenticates users and syncs each user's own TripSplit state. The next production layer for shared trips should store trips as separate Firestore documents with member UIDs and server-side admin rules, so multiple authenticated users can collaborate on the same trip. Do not rely on localStorage or client-side checks for authorization.
