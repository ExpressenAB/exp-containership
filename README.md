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

## Docker files
You will need a Dockerfile describing how to build your container. The first time you run `npm run ecs:init` or `npm run ecs:start`, a default Dockerfile and docker-compose.yml tailored for a Node.js Express app will be created for you.

## Configuration

All configuration of exp-containership is done right inside your package.json. There are sensible defaults for everything so
you dont have to specify a config unless you have special needs.

The following configuration options can be set in package.json under `config.exp-containership`:

| Option       | Default                                    | Description                                                  |
| ------------ | ------------------------------------------ | ------------------------------------------------------------ |
| repo         | exp-docker.repo.dex.nu                     | Docker repository address                                    |
| salt         | https://salt-api.service.consul.xpr.dex.nu | Salt API address                                             |
| ca           | embedded ca                                | Path to the CA certificate (PEM format) to use as validation |
| insecure     | false                                      | Whether to skip CA certificate validation                    |
| eauth        | ldap                                       | The Salt eauth type, typically pam or ldap                   |
| nojobmerge   | false                                      | Whether to merge or overwrite the default helios job config  |
| environments.[env].helios_deployment_group | `[npm_package_name]-[environment]` (for example `nodefish-production`) | Helios deployment group to use per environment. |

Example:

```json
"config": {
  "exp-containership": {
    "repo": "custom-repo.com",
    "environments": {
      "production": {
         "helios_deployment_group": "custom-deploymentgroup"
      }
    }
  }
}
```

#### Adding npm scripts

Add entries to the scripts section to define your exp-containership tasks.

```json
"scripts": {
  "ecs:init": "exp-containership init",
  "ecs:reset": "exp-containership reset",
  "ecs:build": "exp-containership build",
  "ecs:start": "exp-containership run",
  "ecs:prepush": "exp-ensure-unmodified && exp-ensure-master",
  "ecs:push": "npm run ecs:test && exp-containership push",
  "ecs:jobs": "exp-containerdeploy jobs -e",
  "ecs:status": "exp-containerdeploy status -e",
  "ecs:deploy": "exp-containerdeploy deploy -e",
  "ecs:undeploy": "exp-containerdeploy undeploy -e",
  "ecs:open": "exp-containership open",
  "ecs:test": "exp-containership exec web \"cd /exp-container/app && npm install && npm test\"",
  "ecs:shell": "exp-containership exec web bash"
}
```
#### Helios job file (optional)
If you require greater control over Helios you can also define `helios_jobfile` to point to a custom Helios job file for your app. The job file will be merged with the [default job file](scripts/helios-job.json) to produce the final version which is sent to Helios.

* `helios_jobfile` mest be a valid [Helios job configuration file](https://github.com/spotify/helios/blob/master/docs/user_manual.md#using-a-helios-job-config-file)

Let's say you wanted to enable Varnish.

1. Specify your job file in `package.json`
```json
"config": {
  "exp-containership": {
    "environments": {
      "production": {
        "helios_jobfile": "config/production-job.json"
      }
    }
  }
}
```

2. Add the difference to the specified job file
```json
{
  "env" : {
    "VARNISH_ENABLED": true
  }
}
```

3. The final job file will now be the default but with `VARNISH_ENABLED` set to `true`.


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

#### Verbose output

Exp-containership edheres to the npm loglevel, so to get more output during troubleshooting etc:

```bash
$ npm --loglevel verbose run deploy production
```

## Hooks

To define deploy hooks, we utilize the pre/post feature built into the npm script tasks. You can define your own scripts and/or use the ones that come with [exp-deploy](https://github.com/ExpressenAB/exp-deploy) described below.

#### Pre

* ``exp-ensure-unmodified`` - ensures that everything is commited to git
* ``exp-ensure-master`` - ensure that we deploy only from the master branch.
* ``exp-ensure-tests`` - ensure that all tests are running.

#### Post

* ``exp-set-tag`` - sets a "deployed" tag in git to keep track of what is running in production.
