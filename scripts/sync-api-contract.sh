#!/usr/bin/env bash
# Copy the API's generated OpenAPI file in, and make the API types from it.
# Usage: scripts/sync-api-contract.sh <path to public.json>
# Example: scripts/sync-api-contract.sh ../pmservers-api/openapi/public.json
# The API makes the file (openapi/public.json). This repo does not edit it.
set -euo pipefail
cd "$(dirname "$0")/.."

src="${1:-}"
if [ -z "$src" ] || [ ! -f "$src" ]; then
  echo "Usage: scripts/sync-api-contract.sh <path to public.json>" >&2
  exit 1
fi

cp "$src" api/openapi.json
pnpm exec openapi-typescript api/openapi.json -o src/lib/api/schema.d.ts
