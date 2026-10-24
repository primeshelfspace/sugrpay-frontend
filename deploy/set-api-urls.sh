#!/usr/bin/env bash
# Sets the web app's backend addresses in Amplify and rebuilds — run in AWS
# CloudShell (us-west-1). Only the API settings change; every other Amplify
# environment variable is kept as it is.
#
#   Now (one front door):
#     bash set-api-urls.sh https://api.sugrpay.com
#   Once platform-api / sugrpay-api .sugrpay.com have HTTPS:
#     bash set-api-urls.sh https://api.sugrpay.com https://platform-api.sugrpay.com https://sugrpay-api.sugrpay.com
set -euo pipefail
APP_ID="${APP_ID:-d2t9agxhkkuf4e}"
REGION="${REGION:-us-west-1}"
BRANCH="${BRANCH:-main}"
FRONT_DOOR="${1:?usage: set-api-urls.sh <front door> [platform api] [sugrpay api]}"
PLATFORM="${2:-}"
SUGRPAY="${3:-}"

current=$(aws amplify get-app --app-id "$APP_ID" --region "$REGION" --query 'app.environmentVariables' --output json)
updated=$(echo "$current" | jq -c \
  --arg front "$FRONT_DOOR" --arg platform "$PLATFORM" --arg sugrpay "$SUGRPAY" '
  (. // {}) + { NEXT_PUBLIC_API_URL: $front }
  | if $platform == "" then del(.NEXT_PUBLIC_PLATFORM_API_URL) else . + { NEXT_PUBLIC_PLATFORM_API_URL: $platform } end
  | if $sugrpay == "" then del(.NEXT_PUBLIC_SUGRPAY_API_URL) else . + { NEXT_PUBLIC_SUGRPAY_API_URL: $sugrpay } end')

aws amplify update-app --app-id "$APP_ID" --region "$REGION" --environment-variables "$updated" \
  --query 'app.environmentVariables' --output table
aws amplify start-job --app-id "$APP_ID" --branch-name "$BRANCH" --job-type RELEASE --region "$REGION" \
  --query 'jobSummary.[jobId,status]' --output text
echo "Rebuild started; the new addresses are live when it finishes (about 5 minutes)."
