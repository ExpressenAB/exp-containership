# exp-deploy

Simple deployment handling using the npm script feature.

## Requirements

* Linux or OSX
* Applications are managed with pm2 and a ``config/pm2.json`` file must be present.
* Passwordless ssh access to ``web`` user is required to all servers.

## Installation

Just add exp-deploy to your ``devDependencies``.

NOTE: make sure you don't use ``dependencies``, or else shrinkwrap will block the package from being installed. 

## Configuration

All configuration of exp-deploy is done right inside your package.json.

#### Define environments
Add an "exp-deploy" configuration to your package.json, describing your different environments:

```
"config": {
  "exp-deploy": {
    "environments": {
      "production": {"servers": ["prod-server-1", "prod-servgr-2"]},
      "stage": {"servers": ["stage-server"]},
      "test": {"servers": ["test-server"]}
    }
  }
}
```

Valid options are

* ``name`` - name to use for the app (defaults to npm package name).
* ``environments`` - list of environments.
* ``[environment].servers`` - list of servers to deploy to.
* ``[environment].waitForLoadbalancer`` - wait for the loadbalancer to enable a server before proceeeding with the next (defaults to "false").

#### Add deploy tasks

Add entries to the scripts section to define your deployment tasks.

```
"scripts": {
  "deploy-production": "exp-deploy production",
  "deploy-staging": "exp-deploy staging",
  "deploy-test": "exp-deploy test"
}
```

## Running

Invoke just like any other npm script

```prompt> npm run deploy-staging```

#### Server override

If you want to override the config and deploy to a specific server, set the EXP_SERVERS variable.

```prompt> EXP_SERVERS="prod-server-3" npm run deploy-production```

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
  "deploy-test": "exp-deploy test",
  "deploy-staging": "exp-deploy staging",
  "deploy-production": "exp-deploy production",
  "predeploy-prodction": "exp-ensure-tests && exp-ensure-unmodified && exp-ensure-master"
  "postdeploy-production": "exp-set-tag && scripts/send-message-to-slack.sh"
}
```


For ``staging`` and ``test``, just deploy without further actions. For ``production``, ensure that tests run ok, everything is commited to git and that we are on the master branch; afterwards set deploy tag and notify slack using custom script.
