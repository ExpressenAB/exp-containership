# Deployment super fun with exp-containership

#### 1. Make sure you have everything you need.

Talk to your local infrastructure team to ensure you have all of these.

* Url:s etc to any external services your app uses for the concerned envirnoment(s).
* A helios deployment group for each environment you want to deploy to. 
* Ssh access to physical machines.
* An "/_alive" http endpoint in your application, returning "Yes".
* Optionally, if your app has an www endpoint you'll need a port and a backend service name in consul.

There are a lot of new things to take in so don't worry if you don't understand what everything means right now.

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

Otherwise, re-run the command with the '-dd' flag to npm to increase output. Hopefully this will give a hint of what has gone wrong.

```
$ npm -dd run xpr:deploy production
```

If you want to see the status of your app in any given environment, you can use

```
$ npm run xpr:status production
```

#### 5. Access your app

##### WWW

You should now be able to access the www endpoint iof your application, if you have one. The adress is on the format: 
```
http://[environment].[your-app-name].service.consul.xpr.dex.nu/
```
For example "http://production.ursula.service.consul.xpr.dex.nu/".

##### SSH

Run the "xpr:status" npm script for the concerned environment. The output will tell you which servers are hosting your app.
For example:
```
$ npm run xpr:status production
...
┌──────────────┬────────────────────────────────────────────────────────────────────┬─────────┐
│ Host                    Job ID                                                               State   │
├──────────────┼────────────────────────────────────────────────────────────────────┼─────────┤
│ xpr-p-app104    ursula-production:8ae679b:a6cb844a483d97509a777f7ba09fe980c0d15287           RUNNING │
│ xpr-p-app105    ursula-production:8ae679b:a6cb844a483d97509a777f7ba09fe980c0d15287           RUNNING │
└──────────────┴────────────────────────────────────────────────────────────────────┴─────────┘
```

Ssh to a server and check it out. For example, tail the logs: 
```
$ ssh xpr-p-app105
xpr-p-app105> tail -F /var/log/containers/production/ursula/*
```

While still logged in you can go deeper and attach to the docker container with a shell.
```
xpr-p-app105> sudo -i
xpr-p-app105> docker ps 
CONTAINER ID        IMAGE                                               
5b50499439dd        exp-docker.repo.dex.nu/ursula:15339ed         
bb5fe1ed6d61        exp-docker.repo.dex.nu/stromming:07a6458
xpr-p-app105> docker exec -it 5b50499439dd bash
bash# pm2 list
...
bash# pm2 restart 1
```

#### 6. Further reading

##### Custom helios conf

Create your helios job config: [read more](README.md#helios-job-file-optional). For example, when:
* You want to check your app using some other enpoint than `/_alive`.
* You want to add a varnish cache.

##### Read list

* Salt - First endpoint in deployment chain, used mostly for authentication
* Helios - All deployments are helios jobs. Deployment groups define where and how your app is deployed. 
* Consul - Once an app is deployed and running it is managed by consul for health checks and DNS/naming.
* PM2 - Used to keep your app alive inside the docker container.
