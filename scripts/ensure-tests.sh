#!/bin/sh -e

IGNORE="EXP_IGNORE_TESTS"
[[ ${!IGNORE} == true ]] && exit

if ! npm test ; then
  echo "Error: tests failed"
  echo "Set ${IGNORE}=true to ignore this check."
  exit 1
fi
