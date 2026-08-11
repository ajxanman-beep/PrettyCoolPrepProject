# PrettyCoolPrepProject

A sleek dark community landing page designed for connection, collaboration, and modern social interaction.

## Backend

This project now includes a simple Express backend using `server.js`.

- Install dependencies: `npm install`
- Start the server: `npm start`

Cloudinary upload support is enabled by setting these environment variables:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

If those variables are not set, uploads fall back to a local `uploads/` folder.

API endpoints:
- `GET /api/status`
- `GET /api/community`
- `POST /api/join`

## Hosting

This project is ready to deploy on Render as a Node service. Render will use the `start` script from `package.json`.
