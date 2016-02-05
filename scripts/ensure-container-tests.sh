#!/bin/sh -e

IGNORE="EXP_IGNORE_CONTAINER_TESTS"
[[ ${!IGNORE} == true ]] && exit

if ! exp-containership test ; then
  echo "Error: tests failed"
  echo "Set ${IGNORE}=true to ignore this check."
  exit 1
fi
