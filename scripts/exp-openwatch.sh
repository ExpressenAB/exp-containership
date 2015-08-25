#!/bin/bash

while read line
do
  if [[ "$line" =~ "listening on port" ]] ; then
    echo "$line"
    port=$(echo "$line" | egrep -o "[0-9]+$")
    if [ -n "${port}" ]; then
      url="http://$(docker-machine ip exp-docker):$port"
      echo "Opening $url..."
      open "$url"
    fi
  else
    echo "$line"
  fi
done < "${1:-/dev/stdin}"
