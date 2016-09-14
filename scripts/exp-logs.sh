#!/bin/bash -e
SERVICE=$npm_package_name
ENV=${1:-production}
NODES=$2

function cleanup {
  [ -z "$PIDS" ] || kill -9 $PIDS
}
trap cleanup EXIT

URL="http://consul-web.service.consul.xpr.dex.nu/v1/catalog/service/${SERVICE}?tag=$ENV"
NODES=${NODES:-$(curl -Sss "$URL" | tr ',' '\n' | grep Node | sed 's/.*\:\"\(.*\)\"/\1/g')}

for NODE in $NODES
do
  ssh ${NODE}.sth.basefarm.net \
      "ls /var/log/containers/$ENV/$SERVICE/*.log \
          /var/lib/containers/log/$ENV/$SERVICE/*.log | \
       grep -v access | xargs tail -F " &
  PIDS="$PIDS $!"
done

wait
