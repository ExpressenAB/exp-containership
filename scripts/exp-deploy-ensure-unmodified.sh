#!/bin/sh -e
if [[ $(git status --porcelain) ]]; then
  echo "ERROR: You have not committed all your changes to git."
  exit 1
fi
