#!/bin/sh -e

BRANCH=`git rev-parse --abbrev-ref HEAD`

if [[ "$BRANCH" != "master" && "$DEPLOY_FROM_BRANCH" != "true" ]]; then
  echo "Error: You must be on master branch to deploy to \"$ENVIRONMENT\""
  echo "Set DEPLOY_FROM_BRANCH=true to ignore this check and deploy from \"$BRANCH\""
  exit 1
fi
