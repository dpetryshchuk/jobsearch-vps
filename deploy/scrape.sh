#!/bin/bash
set -e
cd /home/dima/jobsearch

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting scrapers"
node_modules/.bin/tsx tools/scrape-hn-jobs.ts
node_modules/.bin/tsx tools/scrape-remoteok.ts
node_modules/.bin/tsx tools/scrape-simplifyjobs.ts
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Done"
