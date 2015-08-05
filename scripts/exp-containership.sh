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
_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_REV=$(git rev-parse --short HEAD)
eval "$($_DIR/docopts.py -h "$help" -V "$version" : "$@")"
build=0
push=0
deploy=0
run=0
runtests=0
prebuild=0
status=0
jobs=0
undeploy=0
for arg in "${argv[@]}"; do
    if [ "$arg" == "build" ]; then
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
    elif [ "$arg" == "test" ]; then
        runtests=1
        environment="${argv[1]:-development}"
        break
    else
    	echo "Invalid argument"
    	exit 1
    fi
done

# setup boot2docker
function boot2docker_shellinit {
    if (which boot2docker >/dev/null); then
        eval $(boot2docker shellinit)
    else
        echo "Need boot2docker to run ${0}, please install it and run this script again"
        exit 1
fi
}
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
	echo "building $npm_package_name-$_REV container"
    #
    if [ ! -e .dockerignore ]; then
        cat <<EOF >$_DIR/.dockerignore
node_modules/*
logs/*
EOF
    fi
    rm -f $npm_package_name-*.tgz
    git archive --format=tar HEAD | gzip > $npm_package_name-$_REV.tgz
	docker build -t $npm_package_name:$_REV .
    rm -f $npm_package_name-*.tgz
fi

if [ $push == 1 ]; then
    boot2docker_shellinit
    echo "tagging  and pushing container"
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:latest
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:latest
fi

if [ $run == 1 ]; then
    VBoxManage showvminfo boot2docker-vm --machinereadable |grep SharedFolderNameMachineMapping|grep -q $npm_package_name
    if [ $? -eq 0 ]; then
        boot2docker_shellinit
        echo "Running $npm_package_name:$_REV bash, listening on $(boot2docker ip):3000"
        boot2docker ssh "sudo mkdir -p /mnt/$npm_package_name && sudo mount -t vboxsf -o uid=$UID $npm_package_name /mnt/$npm_package_name"
        docker run -it -e NODE_ENV=${environment} -e PORT=3000 -v /mnt/$npm_package_name:/src -t -p 3000:3000 $npm_package_name:$_REV bash
    else
        echo "Need to add current folder as a host share, stopping boot2docker..."
        boot2docker stop
        VBoxManage sharedfolder add "boot2docker-vm" --name $npm_package_name --hostpath $(pwd) --automount > /dev/null 2>&1
        boot2docker start
        boot2docker_shellinit
        echo "Running $npm_package_name:$_REV bash, listening on $(boot2docker ip):3000"
        boot2docker ssh "sudo mkdir -p /mnt/$npm_package_name && sudo mount -t vboxsf -o uid=$UID $npm_package_name /mnt/$npm_package_name"
        docker run -it -e NODE_ENV=${environment} -e PORT=3000 -v /mnt/$npm_package_name:/src -t -p 3000:3000 $npm_package_name:$_REV bash
    fi
fi

if [ $runtests == 1 ]; then
    boot2docker_shellinit
    echo "Running tests in container"
    docker run -e NODE_ENV=${environment} -e PORT=3000 -t -p 3000 $npm_package_name:$_REV script /dev/null -c "npm install && npm test"
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