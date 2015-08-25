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
init=0
reset=0
build=0
push=0
deploy=0
run=0
prebuild=0
status=0
jobs=0
undeploy=0
for arg in "${argv[@]}"; do
    if [ "$arg" == "init" ]; then
        init=1
        break
    elif [ "$arg" == "reset" ]; then
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
    elif [ "$arg" == "deploy" ]; then
    	deploy=1
    	environment="${argv[1]:-production}"
    	break
    elif [ "$arg" == "status" ]; then
        status=1
        environment="${argv[1]:-production}"
        break
    elif [ "$arg" == "jobs" ]; then
        jobs=1
        environment="${argv[1]:-production}"
        break
    elif [ "$arg" == "undeploy" ]; then
        undeploy=1
        environment="${argv[1]:-production}"
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

# setup boot2docker
function boot2docker_shellinit {
    if (which docker-machine >/dev/null); then
        ls=$(docker-machine ls | grep "${machine_name}")
        if [ -z "${ls}" ]; then
            echo "Creating docker machine..."
            docker-machine create --driver virtualbox "${machine_name}"
        elif !(echo "${ls}" | grep "Running"); then
            echo "Starting docker machine..."
            docker-machine start "${machine_name}"
        fi
        eval $(docker-machine env "${machine_name}")
    elif [ "${kernel}" != "Linux" ]; then
      echo "Need Docker Machine to proceed, please install Docker Toolbox and run this script again"
      open "https://www.docker.com/toolbox"
      exit 1
    fi
}

# reset
if [ $reset == 1 ]; then
    if [ "${kernel}" != "Linux" ]; then
        if (which docker-machine >/dev/null); then
            ls=$(docker-machine ls | grep "${machine_name}")
            if [ -n "${ls}" ]; then
                echo "Removing docker machine..."
                docker-machine rm "${machine_name}"
            fi
        fi
    fi
fi

# init
if [ $init == 1 ]; then
  boot2docker_shellinit
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
    boot2docker_shellinit
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
    boot2docker_shellinit
    echo "Tagging and pushing $npm_package_name:$_REV container"
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
fi

if [ $run == 1 ]; then
    boot2docker_shellinit
    if !(which docker-compose >/dev/null); then
      echo "Need Docker Compose to proceed, please install Docker Toolbox and run this script again"
      open "https://www.docker.com/toolbox"
      exit 1
    fi
    docker-compose up
fi

if [ $deploy == 1 ]; then
    _IS_REV=$(git log ${argv[2]:-${_REV}} >/dev/null 2>&1)
    if [ $? -eq 0 ]; then
        _COMMIT_INFO=$(git log -1 --format="commit %h (%aD) by %an" ${argv[2]:-${_REV}})
        ${_DIR}/exp-containerdeploy deploy ${environment} ${argv[2]:-${_REV}} ${_COMMIT_INFO}
        #${_DIR}/exp-consulhelper deploy "${_COMMIT_INFO}"
    else
        echo "Not a valid commit."
        exit 1
    fi
fi

if [ $undeploy == 1 ]; then
    _IS_REV=$(git log ${argv[2]:-${_REV}} >/dev/null 2>&1)
    if [ $? -eq 0 ]; then
        _COMMIT_INFO=$(git log -1 --format="commit %h (%aD) by %an" ${argv[2]:-${_REV}})
        ${_DIR}/exp-containerdeploy undeploy ${environment} ${argv[2]:-${_REV}} ${_COMMIT_INFO}
    else
        echo "Not a valid commit."
        exit 1
    fi
fi

if [ $jobs == 1 ]; then
    _IS_REV=$(git log ${argv[2]:-${_REV}} >/dev/null 2>&1)
    if [ $? -eq 0 ]; then
        _COMMIT_INFO=$(git log -1 --format="commit %h (%aD) by %an" ${argv[2]:-${_REV}})
        ${_DIR}/exp-containerdeploy jobs ${environment} ${argv[2]:-${_REV}} ${_COMMIT_INFO}
    else
        echo "Not a valid commit."
        exit 1
    fi
fi

if [ $status == 1 ]; then
    _IS_REV=$(git log ${argv[2]:-${_REV}} >/dev/null 2>&1)
    if [ $? -eq 0 ]; then
        _COMMIT_INFO=$(git log -1 --format="commit %h (%aD) by %an" ${argv[2]:-${_REV}})
        ${_DIR}/exp-containerdeploy status ${environment} ${argv[2]:-${_REV}} ${_COMMIT_INFO}
    else
        echo "Not a valid commit."
        exit 1
    fi
fi
