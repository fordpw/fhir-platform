// mongo-init.js — runs once on first container start as the root user.
// Creates a least-privilege application account with readWrite on fhirdb only.
// MONGO_APP_PASSWORD is injected by the deploy workflow at runtime.
db = db.getSiblingDB('fhirdb')
db.createUser({
  user: 'fhirapp',
  pwd: process.env.MONGO_APP_PASSWORD,
  roles: [{ role: 'readWrite', db: 'fhirdb' }],
})
