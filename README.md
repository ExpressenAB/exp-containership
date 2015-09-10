# exp-containership

Build and deploy applications as containers.

## Requirements

* Linux or Mac OS X
* Docker (Linux) / Docker Toolbox (Mac)
* An account on Expressen's Saltmaster with ACL's allowing you to deploy.

## Installation

```
npm install exp-containership --save-dev
```

## Configuration

All configuration of exp-containership is done right inside your package.json.

You will need a Dockerfile describing how to build your container. The first time you run `npm run init` or `npm run start`, a default Dockerfile and docker-compose.yml tailored for a Node.js Express app will be created for you.

#### Define environments
Add an "exp-containership" configuration section to your `package.json`. The minimum required configuration is `helios_deployment_group` and `repo`.

```json
"config": {
  "exp-containership": {
    "repo": "exp-docker.repo.dex.nu",
    "production": {
      "helios_deployment_group": "nodestarterapp-production",
    }
  }
}
```

#### Helios job file
If you require greater control over Helios you can also define `helios_jobfile` to point to a custom Helios job file for your app. The job file will be merged with the [default job file](scripts/helios-job.json) to produce the final version which is sent to Helios.

* `helios_jobfile` mest be a valid [Helios job configuration file](https://github.com/spotify/helios/blob/master/docs/user_manual.md#using-a-helios-job-config-file)

Let's say you wanted to disable Varnish.

1. Specify your job file in `package.json`
```json
"config": {
  "exp-containership": {
    "production": {
      "helios_jobfile": "config/production.job"
    }
  }
}
```

2. Add the difference to the specified job file
```json
{
  "env" : {
    "VARNISH_ENABLED": false
  }
}
```

3. The final job file will now be the default but with `VARNISH_ENABLED` set to `false`.

#### Adding npm scripts

Add entries to the scripts section to define your exp-containership tasks.

```json
"scripts": {
  "init": "exp-containership init",
  "reset": "exp-containership reset",
  "build": "exp-containership build",
  "start": "exp-containership run",
  "prepush": "exp-ensure-unmodified && exp-ensure-master",
  "push": "exp-containership build && exp-containership push",
  "jobs": "exp-containerdeploy jobs -e",
  "status": "exp-containerdeploy status -e",
  "deploy": "exp-containerdeploy deploy -e",
  "undeploy": "exp-containerdeploy undeploy -e"
}
```

## Running

Invoke just like any other npm script:

```bash
# Start the container for local development
$ npm run start

# Commit your changes
$ git commit -m "further awesomeness added"

# Build, tag and push the container to the specified Docker repo
$ npm run push

# Deploy the container to production
$ npm run deploy production
```

## Hooks

To define deploy hooks, we utilize the pre/post feature built into the npm script tasks. You can define your own scripts and/or use the ones that come with [exp-deploy](https://github.com/ExpressenAB/exp-deploy) described below.

#### Pre

* ``exp-ensure-unmodified`` - ensures that everything is commited to git
* ``exp-ensure-master`` - ensure that we deploy only from the master branch.
* ``exp-ensure-tests`` - ensure that all tests are running.

#### Post

* ``exp-set-tag`` - sets a "deployed" tag in git to keep track of what is running in production.
