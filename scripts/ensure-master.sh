#!/bin/sh -e

IGNORE="EXP_DEPLOY_IGNORE_MASTER"
BRANCH=`git rev-parse --abbrev-ref HEAD`

if [[ "$BRANCH" != "master" && ${!IGNORE} != true ]]; then
  echo "Error: You must be on master branch to deploy to \"$ENVIRONMENT\""
  echo "Set ${IGNORE}=true to ignore this check and deploy from \"$BRANCH\""
  exit 1
fi
