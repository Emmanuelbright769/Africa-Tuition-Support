#!/bin/bash
set -e

# Install/sync dependencies
npm install

# Push DB schema changes (non-interactive)
npm run db:push 2>/dev/null || true
