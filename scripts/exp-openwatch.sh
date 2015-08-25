#!/bin/bash

while read line
do
  if [[ "$line" =~ "listening on port" ]] ; then
    echo "$line"
    port=$(echo "$line" | egrep -o "[0-9]+$")
    if [ -n "${port}" ]; then
      url="http://$(docker-machine ip exp-docker):$port"
      n=0
      while !(curl -fs -o /dev/null "$url"); do
        sleep 1
        let n=n+1
        if [ n = 5 ]; then
          break
        fi
      done
      echo "Opening $url..."
      open "$url"
    fi
  else
    echo "$line"
  fi
done < "${1:-/dev/stdin}"
