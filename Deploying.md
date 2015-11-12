# Deployment super fun with exp-containership

#### 1. Make sure you have everything you need.

Talk to your local infrastructure team if you are missing any of these:

* Url:s etc to any external services your app uses for the concerned envirnoment(s).
* A helios deployment group for each environment you want to deploy to.


#### 2. Add deployment related scripts to your package.json

```
"scripts": {

  ...

  "xpr:push": "npm run xpr:test && exp-containership push",
  "xpr:status": "exp-containerdeploy status -e",
  "xpr:deploy": "exp-containerdeploy deploy -e"
  
}
```

#### 3. Push your docker image to the docker repo

```
$ npm run xpr:push
```

NOTE: your in-container tests must succeed for the push to complete.

#### 4. Deploy docker image to an environment of choice.

For the sake of simplicity we will use the "production" environment in all examples from here on. This can of course be replaced with whatever environment your are working on.

```
$ npm run xpr:deploy production
```

If all goes well, you will be met with the following sight:

```
┌─────────────┬────────┐
│ Status          DONE   │
├─────────────┼────────┤
│ Parallelism    1       │
├─────────────┼────────┤
│ Duration       23.709  │
├─────────────┼────────┤
│ Timeout        120     │
└─────────────┴────────┘
```

Otherwise, re-run the command with the '-dd' flag to npm to increase output. Show this outout to
your local infrastructure team for further help:

```
$ npm -dd run xpr:deploy production
```

If you want to see the status of your app in any given environment, you can use

```
$ npm run xpr:status production
```

####5 Further reading

Technologies used behind the scenes:

* Salt - First endpoint in deployment chain, used mostly for authentication
* Helios - All deployments are helios jobs. 
* Consul - Once an app is deployed and running it is managed by consul for health checks and DNS/naming.
* PM2 - Used to keep your app alive inside the docker container.
