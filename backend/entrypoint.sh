#!/bin/sh
set -e

echo "🔧 Running database migrations..."
npm run db:migrate

echo "🚀 Starting server..."
npm run start