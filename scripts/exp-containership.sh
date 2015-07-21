#!/bin/bash
#? exp-containership 0.1.0

##? Usage: exp-containership [options] <argv>...
##?
##?       --help     Show help options.
##?       --version  Print program version.

help=$(grep "^##?" "$0" | cut -c 5-)
version=$(grep "^#?"  "$0" | cut -c 4-)
_DIR=$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )
_REV=$(git rev-parse --short HEAD)
eval "$($_DIR/docopts.py -h "$help" -V "$version" : "$@")"
build=0
push=0
deploy=0
run=0
for arg in "${argv[@]}"; do
    if [ "$arg" == "build" ]; then
        build=1
        break
    elif [ "$arg" == "push" ]; then
    	push=1
    	break
    elif [ "$arg" == "deploy" ]; then
    	deploy=1
    	environment="${argv[1]:-production}"
    	break
    elif [ "$arg" == "run" ]; then
        run=1
        environment="${argv[1]:-dev}"
        break
    else
    	echo "Invalid argument"
    	exit 1
    fi
done

# build
if [ $build == 1 ]; then
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
fi

if [ $push == 1 ]; then
    echo "tagging  and pushing container"
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker tag -f $npm_package_name:$_REV $npm_package_config_exp_containership_repo/$npm_package_name:latest
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:$_REV
    docker push $npm_package_config_exp_containership_repo/$npm_package_name:latest
fi

if [ $run == 1 ]; then
    #VBoxManage sharedfolder add "boot2docker-vm" --name "src" --hostpath "/path/to/base/folder"
    boot2docker ssh sudo mkdir -p /src
    boot2docker ssh sudo mount -t vboxsf -o uid=1000,gid=50 src /src
    docker run -it -e NODE_ENV=${environment} -v /src:/src -t -p 3000 $npm_package_name:$_REV bash
fi