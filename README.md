# exp-deploy

Simple deploy script. Works fine on OSX and Linux, most likely not on Windows.

## Installation

Just add exp-deploy to your devDependencies.

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

Add entries to the scripts section for deploy tasks

```
"scripts": {
  "deploy-production": "exp-deploy production",
  "deploy-staging": "exp-deploy staging",
  "deploy-test": "exp-deploy test"
}
```

## Running

Invoke just like any other npm script

```
prompt> npm run deploy-staging
```

#### Server override

If you want to override the config and deploy to a specific server only you can do this using an extra parameter:

```
prompt> npm run deploy-production -- prod-server-1
```

NOTE: this requires npm version 2.0 or later.

## Hooks

To define deploy hooks, we utilze the pre/post feature built in to the npm script task. You can define your own scripts and/or use the ones that come with exp-deploy. 

#### Pre
Certain environments are extra sensitive (I'm looking at you "production"...), and you want to assert that everything is just perfect before you proceed with the deployment. Exp-config provides a number of hooks that can be used for this:

* ``exp-deploy-ensure-unmodified`` - ensures that everything is commited to git
* ``exp-deploy-ensure-master`` - ensure that we deploy only from the master branch.
* ``exp-deploy-version-bumped`` - ensure that the version number in package.json is bumped before deploy.

#### Post

After the deploy is done there are usually some things you want to do, exp-deploy defines the following hooks

* ``exp-deploy-set-tag`` - sets a "deployed" tag in git to keep track of what is running in production.

#### Example

```
"scripts": {
  "deploy-test": "exp-deploy test",
  "deploy-staging": "exp-deploy staging",
  "deploy-production": "exp-deploy production",
  "predeploy-prodction": "npm test && exp-deploy-ensure-unmodified && exp-deploy-ensure-master"
  "postdeploy-production": "exp-deploy-set-tag && scripts/send-message-to-slack.sh"
}
```


For ``staging`` and ``test``, just deploy without further actions. For ``production``, ensure that tests run ok, everything is commited to git and that we are on the master branch; afterwards set deploy tag and notify slack using custom script.
