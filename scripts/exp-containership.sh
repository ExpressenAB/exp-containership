#!/bin/bash
#? exp-containership 0.1.0

##? Usage: exp-containership [options] <argv>...
##?
##?       --help     Show help options.
##?       --version  Print program version.
#
#
#set -x
#set -euf -o pipefail
help=$(grep "^##?" "$0" | cut -c 5-)
version=$(grep "^#?"  "$0" | cut -c 4-)
kernel=$(uname -s)
machine_name="exp-docker"
_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_REV=$(git rev-parse --short HEAD)
eval "$($_DIR/docopts.py -h "$help" -V "$version" : "$@")"
init=1
reset=0
build=0
push=0
run=0
prebuild=0
for arg in "${argv[@]}"; do
    if [ "$arg" == "init" ]; then
        init=1
        break
    elif [ "$arg" == "reset" ]; then
        init=0
        reset=1
        break
    elif [ "$arg" == "build" ]; then
        build=1
        break
    elif [ "$arg" == "prebuild" ]; then
        prebuild=1
        break
    elif [ "$arg" == "push" ]; then
    	push=1
    	break
    elif [ "$arg" == "run" ]; then
        run=1
        environment="${argv[1]:-development}"
        break
    else
    	echo "Invalid argument"
    	exit 1
    fi
done

# reset
if [ $reset == 1 ]; then
    if [ "${kernel}" != "Linux" ]; then
        if (which docker-machine >/dev/null); then
            ls=$(docker-machine ls | grep "${machine_name}")
            if [ -n "${ls}" ]; then
                echo "Removing docker machine..."
                docker-machine rm "${machine_name}" >/dev/null
            fi
        fi
    fi
fi

# init
if [ $init == 1 ]; then
  if (which docker-machine >/dev/null); then
      ls=$(docker-machine ls | grep "${machine_name}")
      if [ -z "${ls}" ]; then
          echo "Creating docker machine..."
          docker-machine create --driver virtualbox "${machine_name}" >/dev/null
      elif !(echo "${ls}" | grep "Running" >/dev/null); then
          echo "Starting docker machine..."
          docker-machine start "${machine_name}" >/dev/null
      fi
      eval $(docker-machine env "${machine_name}")
  elif [ "${kernel}" != "Linux" ]; then
    echo "Need Docker Machine to proceed, please install Docker Toolbox and run this script again"
    open "https://www.docker.com/toolbox"
    exit 1
  fi

  if ! [ -f "./Dockerfile" ]; then
    cp "${_DIR}/../exp-containership/templates/Dockerfile" .
  fi

  if ! [ -f "./docker-compose.yml" ]; then
    cp "${_DIR}/../exp-containership/templates/docker-compose.yml" .
  fi
fi

# prebuild
if [ $prebuild == 1 ]; then
    IGNORE="EXP_IGNORE_UNMODIFIED"

    if [[ $(git status --porcelain) && ${!IGNORE} != true ]]; then
      echo "ERROR: You have not committed all your changes to git."
      echo "SET ${IGNORE}=true to ignore this check."
      exit 1
    fi
fi

# build
if [ $build == 1 ]; then
    echo "Building container $npm_package_name:$_REV"
    #
    if [ ! -e .dockerignore ]; then
        cat <<EOF >$_DIR/.dockerignore
node_modules
logs
EOF
    fi
	  docker build -t $npm_package_name:$_REV .
fi

if [ $push == 1 ]; then
    echo "Tagging and pushing $npm_package_name:$_REV container"
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
fi

if [ $run == 1 ]; then
    if !(which docker-compose >/dev/null); then
      echo "Need Docker Compose to proceed, please install Docker Toolbox and run this script again"
      open "https://www.docker.com/toolbox"
      exit 1
    fi
    docker-compose up 2>&1 | ${_DIR}/exp-openwatch
fi
