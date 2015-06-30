#!/bin/sh -e

BRANCH=`git rev-parse --abbrev-ref HEAD`
IGNORE="EXP_DEPLOY_IGNORE_MASTER"

if [[ "$BRANCH" != "master" && ${!IGNORE} != "true" ]]; then
  echo "Error: You must be on master branch to deploy to \"$ENVIRONMENT\""
  echo "Set ${IGNORE}=true to ignore this check and deploy from \"$BRANCH\""
  exit 1
fi
