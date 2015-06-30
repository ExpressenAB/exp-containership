function sshAndLog {
  CMD_NAME=$1
  CMD=$2
  COLOR='\033[0;33m'
  RESET_COLOR='\033[0m'
  echo "==> $CMD_NAME"
  echo -e "$COLOR$CMD$RESET_COLOR"
  ssh "web@$server" "$CMD"
}

function waitForLoadbalancer {
  # Ideally we'd like to monitor the server here and make sure that the load
  # balancer actually sends traffic to it. However, we'll just wait
  # 16 seconds for now and then consider the server active.
  echo "==> Waiting 16 seconds for load balancer..."
  sleep 16
}
