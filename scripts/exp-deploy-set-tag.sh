#!/bin/sh -e

# Skip tagging if we are not deploying to all servers.
if [[ -z $EXP_DEPLOY_SERVERS ]]; then
  git tag -f deployed
  git push --force origin deployed
fi
