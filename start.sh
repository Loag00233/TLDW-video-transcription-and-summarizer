#!/bin/bash
cd "$(dirname "$0")"

# Open browser only on first launch
(sleep 4 && open http://localhost:3000) &

while true; do
  npm run dev
  echo "↻ Server stopped — restarting in 1s..."
  sleep 1
done
