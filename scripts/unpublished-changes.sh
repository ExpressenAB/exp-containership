#!/usr/bin/env bash

environment="${1:-production}"
publishedrevision="$(exp-containerdeploy status -e \"${environment}\" | grep 'Job Id' | cut -f2 -d ':')"

echo "The published revision for environment '${environment}' is ${publishedrevision}"

git --no-pager log \
      --pretty=format:'%Cred%h%Creset -%C(yellow)%d%Creset %s %Cgreen(%cr) %C(bold blue)<%an>%Creset' \
      --abbrev-commit \
      --date=relative \
      "${publishedrevision}...HEAD"
