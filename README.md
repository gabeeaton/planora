# Planora

Planora is an AI-powered planner for students. It brings assignments, deadlines, and study time into one place so students can decide what to work on next.

## Features

- Import assignments from an ICS calendar feed, including feeds from learning management systems such as Canvas.
- Prioritize tasks using deadlines, course context, and past activity.
- Generate a day-by-day study plan around available time.
- Use an AI coach to break down assignments and plan the week.
- Track grades, focus sessions, and semester progress.

## Tech stack

React Native and Expo for the mobile app, Firebase for authentication and data, OpenAI for planning and coaching, and RevenueCat for subscriptions. The AI API is served through Vercel.

## Run locally

```bash
npm install
npx expo start
```

Set up a local `.env` with the Firebase values and Vercel API URL used in `src/config.js`, plus the RevenueCat key used in `src/services/purchases.js`. Keep secrets out of version control.
