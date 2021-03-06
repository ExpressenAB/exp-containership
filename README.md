# exp-containership

Build and deploy applications as containers.

Newcomers, start here please:
* [Development quickstart](Quickstart.md#development-super-fun-with-exp-containership)
* [Deployment quickstart](Deploying.md#deployment-super-fun-with-exp-containership)

Problems look at [issues](#issues)

## Configuration

All configuration of exp-containership is done right inside your package.json.
*There are sensible defaults for everything so you dont have to specify a config unless you have special needs.*

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
| size         | small                                      | Size of the deployment group, must be one of "small", "medium", "large" or "xlarge". |

Example:

```json
"config": {
  "exp-containership": {
    "repo": "custom-repo.com",
    "environments": {
      "production": {
         "helios_deployment_group": "custom-deploymentgroup",
         "size": "medium"
      }
    }
  }
}
```

#### Adding npm scripts

Add entries to the scripts section to define your exp-containership tasks.

```json
"scripts": {
  "xpr:init": "exp-containership init",
  "xpr:reset": "exp-containership reset",
  "xpr:build": "exp-containership build",
  "xpr:start": "exp-containership run",
  "xpr:push": "exp-containership push",
  "prexpr:push": "exp-ensure-unmodified && exp-ensure-master && exp-ensure-container-tests",
  "xpr:jobs": "exp-containerdeploy jobs -e",
  "xpr:status": "exp-containerdeploy status -e",
  "xpr:deploy": "exp-containerdeploy deploy -e",
  "xpr:restart": "exp-containerdeploy restart",
  "prexpr:deploy": "exp-ensure-unmodified && exp-ensure-master && exp-ensure-container-tests",
  "xpr:undeploy": "exp-containerdeploy undeploy -e",
  "xpr:init-deployment": "exp-containerdeploy init-deployment -e",
  "xpr:open": "exp-containership open",
  "xpr:test": "exp-containership test",
  "xpr:shell": "exp-containership exec web bash",
  "xpr:logs": "exp-logs",
  "xpr:unpublished-changes": "unpublished-changes"
}
```
#### Custom pm2 config (optional)

If the pm2 config shipped with the base image (found [here](https://github.com/ExpressenAB/node-starterapp/blob/infra/dockerize/docker/exec/app.json) and [here](https://github.com/ExpressenAB/node-starterapp/blob/infra/dockerize/docker/exec/dev_app.json)) does not suit your needs, you can specify your own. Add two files called `config/dev_app.json` and `config/app.json` to your application. The former will be used as pm2 config when running your app on your local development machine, the latter will be used in all other environments ("livedata", "production" etc).

You then overwrite the original pm2 config by adding the following line where you prefer in your `Dockerfile`:

```
ADD config/*app.json /exp-container/exec/
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
$ npm run xpr:start

# Commit your changes
$ git commit -m "further awesomeness added"

# Build, tag and push the container to the specified Docker repo
$ npm run xpr:push

# Deploy the container to production
$ npm run xpr:deploy production
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
* ``exp-ensure-container-tests`` - ensures that everything is commited to git

#### Post

* ``exp-set-tag`` - sets a "deployed" tag in git to keep track of what is running in production.

## Log tailing

You can conveniently tail log files in different environments using the log script included with exp-containership. It will use ssh to connect to the servers, so make sure to setup [passwordless login](Passless.md) or you'll risk loosing your mind from repeated username/password typing. 

Just make sure to add the following script entry to your package.json:

```
"scripts": {
  ...
  "xpr:logs": "exp-logs",
  ...
}
```

To tail production logs on all servers (default mode):

```
$ npm run xpr:logs
```

To view all logs on all servers in some other environment:

```
$ npm run xpr:logs epistage
```

To view all logs on a specific server:

```
$ npm run xpr:logs production xpr-p-app101
```

## Restarting a node

The restart command requires both environment and host. (To see available hosts issue a "xpr:status" command).

```
$npm run xpr:restart production xpr-p-app102
```

## OSX Docker

If you are using the [OSX Docker beta](https://beta.docker.com/), set the following environment variable and exp-containership should abide.

```
EXP_OSX_DOCKER=true
```

# Issues

## Certificate issue

Example error message:
```
Error checking TLS connection: Error checking and/or regenerating the certs: There was an error validating certificates for host "192.168.99.100:2376": x509: certificate is valid for 192.168.99.101, not 192.168.99.100
You can attempt to regenerate them using 'docker-machine regenerate-certs [name]'.
Be advised that this will trigger a Docker daemon restart which will stop running containers.
```

run: 
```bash
docker-machine regenerate-certs -f exp-docker
```
