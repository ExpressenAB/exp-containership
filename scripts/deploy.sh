#!/bin/bash -e

ENVIRONMENT=$1
SERVERS_OVERRIDE=$2
PREFIX="npm_package_config_exp_deploy_environments_"

echo "==> Building $ENVIRONMENT"

APP_NAME_VAR=${PREFIX}name
APP_NAME=${!APP_NAME_VAR:-$npm_package_name}

WAIT_FOR_LOADBALANCER_VAR=${PREFIX}waitForLoadbalancer
WAIT_FOR_LOADBALANCER=${!WAIT_FOR_LOADBALANCER_VAR}

# Get servers from package.json config
SERVERS=""
N=0
while SERVER_VAR=${PREFIX}${ENVIRONMENT}_servers_${N} && [ ${!SERVER_VAR} ]; do
      SERVERS="$SERVERS ${!SERVER_VAR}"
      let N=N+1
done
if [[ -z $SERVERS ]]; then
  echo "ERROR: No servers configured for environment \"$ENVIRONMENT\""
  exit 1
fi

# Make it possible to deploy on a specific server
if [[ -n $SERVERS_OVERRIDE ]]; then
  SERVERS=$SERVERS_OVERRIDE
fi

# Pack app
PACKAGE=$(npm pack | tail -1)

function sshAndLog {
  CMD_NAME=$1
  CMD=$2
  COLOR='\033[0;33m'
  RESET_COLOR='\033[0m'
  echo "==> $CMD_NAME"
  echo -e "$COLOR$CMD$RESET_COLOR"
  ssh "web@$server" "$CMD"
}

function waitForConnections {
  if [[ ${WAIT_FOR_LOADBALANACER} -eq 1 ]]; then
    # Ideally we'd like to monitor the server here and make sure that the load
    # balancer actually sends traffic to it. However, we'll just wait
    # 16 seconds for now and then consider the server active.
    echo "==> Waiting 16 seconds for load balancer..."
    sleep 16
  fi
}

DATE=$(date "+%Y-%m-%dT%H.%M.%S")
RELEASE_DIR="/home/web/$APP_NAME/releases/$DATE"
CUR_DIR="/home/web/$APP_NAME/current"
SHAREDMODULES_DIR="/home/web/$APP_NAME/shared/node_modules"

for server in $SERVERS; do
  echo "==> Deploying to $server"
  sshAndLog "Creating release dir" "mkdir -p $RELEASE_DIR"
  sshAndLog "Creating shared dir" "mkdir -p $SHAREDMODULES_DIR"
  sshAndLog "Linking shared dir" "ln -s $SHAREDMODULES_DIR $RELEASE_DIR/node_modules"
  echo "==> Upload package"
  ssh "web@$server" "tar zx --strip-components 1 -C $RELEASE_DIR/." < "./$PACKAGE"
  sshAndLog "Ensure node version via nvm" "cd $RELEASE_DIR && nvm install"
  sshAndLog "Update npm" "cd $RELEASE_DIR && nvm use && npm prune --production && npm install --production"

  set +e
  sshAndLog "Remove 'alive' file to remove server from load balancer" "cd $CUR_DIR && rm config/alive"
  set -e

  sshAndLog "Update symlink" "ln -sfT $RELEASE_DIR $CUR_DIR"
  sshAndLog "Restart service" "cd $CUR_DIR && nvm use && NODE_ENV=$ENVIRONMENT pm2 startOrRestart $CUR_DIR/config/pm2.json && pm2 save"
  sshAndLog "Cleanup" "cd /home/web/$APP_NAME/releases && ls -tr | head -n -5 | xargs --no-run-if-empty rm -r"
  waitForConnections
done

