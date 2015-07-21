# exp-containership

Build and deploy applications as containers.

## Requirements

* Linux or OSX
* boot2docker installed
* node-starterapp/docker directory

## Installation

Just add exp-containership to your ``devDependencies``.

NOTE: make sure you don't use ``dependencies``, or else shrinkwrap will block the package from being installed. 

## Configuration

All configuration of exp-containership is done right inside your package.json.

#### Define environments
Add an "exp-containership" configuration to your package.json, describing your build:

```
  "config": {
    "exp-containership": {
      "repo": "exp-docker.repo.dex.nu",
      "production": {
        "frontend": {
          "port": 1234,
          "backends": "tag.appname"
        },
        "instances": 4
      }
    }
  },
```

Valid options are

* ``name`` - name to use for the app (defaults to npm package name).
* ``repo`` - map of repo config
* ``[environment]frontend`` - internal loadbalancer config
* ``[environment].frontend.port`` - listen port for the internal loadbalancer.
* ``[environment].frontend.backends`` - the desired backend service, defaults to <environment>.<name>
* ``[environment].instances`` - number of desired containers to start

#### Add container tasks

Add entries to the scripts section to define your container tasks.

```
"scripts": {
  "container-build": "exp-containership build",
  "container-push": "exp-containership push",
  "container-run": "exp-containership run",
  "container-deploy-production": "exp-containership deploy production",
  "container-deploy-staging": "exp-containership deploy staging"
}
```

## Running

Invoke just like any other npm script

- Build the container:
```prompt> npm run container-build```
- Run the container:
```prompt> npm run container-run```
- Push the container to the specified repo
```prompt> npm run container-push```
- Run the container in production
```prompt> npm run container-deploy-production``


## Hooks

To define deploy hooks, we utilze the pre/post feature built into the npm script task. You can define your own scripts and/or use the ones that come with exp-deploy described below.

#### Pre

* ``exp-ensure-unmodified`` - ensures that everything is commited to git
* ``exp-ensure-master`` - ensure that we deploy only from the master branch.
* ``exp-ensure-tests`` - ensure that all tests are running.

#### Post

* ``exp-set-tag`` - sets a "deployed" tag in git to keep track of what is running in production.

#### Example

```
"scripts": {
  "container-build": "exp-containership build",
  "container-push": "exp-containership push",
  "container-run": "exp-containership run",
  "container-deploy-production": "exp-containership deploy production",
  "container-deploy-staging": "exp-containership deploy staging"
  "predeploy-production": "exp-ensure-tests && exp-ensure-unmodified && exp-ensure-master"
  "postdeploy-production": "exp-set-tag && scripts/send-message-to-slack.sh"
}
```


For ``staging`` and ``test``, just deploy without further actions. For ``production``, ensure that tests run ok, everything is commited to git and that we are on the master branch; afterwards set deploy tag and notify slack using custom script.
