#!/bin/bash

kernel=$(uname -s)
machine_name="exp-docker"
_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_REV=$(git rev-parse --short HEAD)
init=1
reset=0
build=0
test=0
push=0
run=0
prebuild=0
open=0
exec=0

if [ "$1" == "init" ]; then
    init=1
elif [ "$1" == "reset" ]; then
    init=0
    reset=1
elif [ "$1" == "build" ]; then
    build=1
elif [ "$1" == "test" ]; then
    build=1
    exec=1
    exec_cmd="NODE_ENV=test npm install && npm test"
elif [ "$1" == "prebuild" ]; then
    prebuild=1
elif [ "$1" == "push" ]; then
    push=1
elif [ "$1" == "run" ]; then
    run=1
elif [ "$1" == "open" ]; then
    open=1
elif [ "$1" == "exec" ]; then
    [ -z "$2" ] && { echo "ERROR: missing command to execute"; exit 1; }
    build=1
    exec=1
    exec_cmd=$2
else
    echo "Invalid argument"
    exit 1
fi

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
      home="/Volumes/Data/Users"
      if [ -z "${ls}" ]; then
          echo "Creating docker machine..."
          docker-machine create \
            --driver virtualbox \
            --virtualbox-memory "2048" \
            --virtualbox-disk-size "40000" \
            "${machine_name}" >/dev/null
          if [ -e "${home}" ]; then
            docker-machine stop "${machine_name}" >/dev/null
            VBoxManage sharedfolder add "${machine_name}" \
              --name exp --hostpath $home --automount > /dev/null 2>&1
            VBoxManage setextradata "${machine_name}" \
              VBoxInternal2/SharedFoldersEnableSymlinksCreate/exp 1
            docker-machine start "${machine_name}" >/dev/null
          fi
      elif !(echo "${ls}" | grep "Running" >/dev/null); then
          echo "Starting docker machine..."
          docker-machine start "${machine_name}" >/dev/null
      fi
      if [ -e "${home}" ]; then
        docker-machine ssh "${machine_name}" \
          "sudo mkdir -p \"${home}\" && sudo mount -t vboxsf -o uid=1000 -o gid=50 exp \"${home}\""
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

  if ! [ -f "./.dockerignore" ]; then
    cp "${_DIR}/../exp-containership/templates/.dockerignore" .
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
	  docker build -t $npm_package_name:$_REV .
fi

if [ $push == 1 ]; then
    echo "Tagging and pushing $npm_package_name:$_REV container"
    docker tag -f $npm_package_name:$_REV ${npm_package_config_exp_containership_repo:-exp-docker.repo.dex.nu}/$npm_package_name:$_REV
    docker push ${npm_package_config_exp_containership_repo:-exp-docker.repo.dex.nu}/$npm_package_name:$_REV
fi

if [ $run == 1 ]; then
    if !(which docker-compose >/dev/null); then
      echo "Need Docker Compose to proceed, please install Docker Toolbox and run this script again"
      open "https://www.docker.com/toolbox"
      exit 1
    fi
    shift
    docker-compose stop "$@"
    docker-compose rm -f "$@"
    docker-compose build "$@"
    docker-compose up "$@"
fi

if [ $exec == 1 ]; then
    echo "Running command \"$exec_cmd\" in container $npm_package_name:$_REV"
    if [ "${kernel}" != "Linux" ]; then
      eval $(VBoxManage showvminfo "$machine_name" --machinereadable | grep hostonlyadapter)
      ip=$(ifconfig "$hostonlyadapter2" | grep 'inet ' | awk '{ print $2 }')
    else
      ip=$(ifconfig eth0 | grep 'inet ' | awk '{ print $2 }')
    fi
    docker run -it --rm --add-host="host:$ip" --entrypoint bash "$npm_package_name:$_REV" -c "cd /exp-container/app && $exec_cmd"
fi

if [ $open == 1 ]; then
  docker-compose ps | grep Up | grep web_1 > /dev/null || { echo "ERROR: No web container found."; exit 1; }
  container=$(docker-compose ps | grep web_1 | awk 'END{print $1}')
  ip=$(docker-machine ip $machine_name)
  port=$(docker port "$container" | awk -F ':' '{print $NF}')
  open "http://$ip:$port"
fi
