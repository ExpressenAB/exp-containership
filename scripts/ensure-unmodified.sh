#!/bin/sh -e

IGNORE="EXP_IGNORE_UNMODIFIED"

if [[ $(git status --porcelain) && ${!IGNORE} != true ]]; then
  echo "ERROR: You have not committed all your changes to git."
  echo "SET ${IGNORE}=true to ignore this check."
  exit 1
fi
