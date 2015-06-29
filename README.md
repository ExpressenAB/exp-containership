# exp-deploy

Simple deploy script. Works fine on OSX and Linux, most likely not on Windows.

## Installation

Just add exp-deploy to your devDependencies.

## Configuration

Add an "exp-deploy" configuration to your package.json, describing your different environments:

```
"config": {
  "exp-deploy": {
    "environments": {
      "production": {"servers": ["prod-server-1", "prod-servgr-2"]},
      "stage": {"servers": ["stage-server"], "runTests": true},
      "test": {"servers": ["test-server"]}
    }
  }
}
```

Valid options are

* name - name to use for the app (defaults to npm package name).
* environments: list of environments.
* [environment].servers - list of servers to deploy to.
* [environment].waitForLoadbalancer - wait for the loadbalancer to enable a server before proceeeding with the next (defaults to "false").
* [environment].runTests - run all tests before proceeding with deploy (defaults to "true" if the environment is "production", otherwise "false").
* [environment].forceUnmodified - ensure all changes are committed to git (defaults to "true" if the environment is "production", otherwise "false").
* [environment].forceMaster - only allow deploys from "master" branch (defaults to "true" if the environment is "production", otherwise "false").

Also add an entry to the scripts section for deploy tasks

```
"scripts": {
  "deploy-production": "exp-deploy production",
  "deploy-staging": "exp-deploy staging",
  "deploy-test": ""
}
```

## Running

Invoke just like any other npm script

```
prompt> npm run deploy-staging
```

If you want to override the config and deploy to a specific server only you can do this using an extra parameter:

```
prompt> npm run deploy-production -- prod-server-1
```


