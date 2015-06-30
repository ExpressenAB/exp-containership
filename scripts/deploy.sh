#!/bin/bash -e

source node_modules/exp-deploy/scripts/util.sh

ENVIRONMENT=$1
PREFIX="npm_package_config_exp_deploy_environments_"

echo "==> Building $ENVIRONMENT"

APP_NAME_VAR=${PREFIX}name
APP_NAME=${!APP_NAME_VAR:-$npm_package_name}

WAIT_FOR_LOADBALANCER_VAR=${PREFIX}{$ENVIRONMENT}_waitForLoadbalancer
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
if [[ -n $EXP_SERVERS ]]; then
  SERVERS=$EXP_SERVERS
fi

# Pack app
PACKAGE=$(npm pack | tail -1)
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
  sshAndLog "Update symlink" "ln -sfT $RELEASE_DIR $CUR_DIR"

  set +e
  sshAndLog "Remove 'alive' file to remove server from load balancer" "cd $CUR_DIR && rm config/alive"
  set -e

  sshAndLog "Restart service" "cd $CUR_DIR && nvm use && NODE_ENV=$ENVIRONMENT pm2 startOrRestart $CUR_DIR/config/pm2.json && pm2 save"
  sshAndLog "Cleanup" "cd /home/web/$APP_NAME/releases && ls -tr | head -n -5 | xargs --no-run-if-empty rm -r"
  waitForLoadbalancer $WAIT_FOR_LOADBALANCER
done
