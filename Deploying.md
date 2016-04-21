# Deployment super fun with exp-containership

#### 1. Make sure you have everything you need.

Talk to your local infrastructure team to ensure you have all of these:

* Url:s etc to any external services your app uses for the concerned environment(s).
* A helios deployment group for each environment you want to deploy to.
* Access to the salt master
* Ssh access to physical machines.
* An "/_alive" http endpoint in your application, returning "Yes".
* A port and a backend service name in consul (if your app exposes an http endpoint) and a deployment group. This should be created using the `init-deployment` command.

There are a lot of new things to take in so don't worry if you don't understand what everything means right now.

#### 2. Add deployment related scripts to your package.json

```
"scripts": {

  ...

  "xpr:status": "exp-containerdeploy status -e",
  "xpr:deploy": "exp-containerdeploy deploy -e",
  "xpr:unpublished-changes": "unpublished-changes",
  "xpr:init-deployment": "exp-containerdeploy init-deployment -e"
}
```

#### 3. Deploy docker image to an environment of choice.

NOTE: For the sake of simplicity we will use the "production" environment in all examples from here on. This can of course be replaced with whatever environment your are working on.

To get started, create your application context:

```
$ npm run xpr:init-deployment production
# Repeat this for each environment you need to run your application in, valid envs are: production, livedata, epistage and epitest
```


Then, determine which changes would be deployed by running:

```
npm run xpr:unpublished-changes production
```

This will show the commits in the current git branch that are not currently deployed.

Issue the following command to deploy your app:

```
$ npm run xpr:deploy production
```

This task will

* Ensure that the docker repo contains an image for your build. 
* If not; build, test and push the image to the docker repo.
* Start a deployment job deploying the docker image and wait for it to finish.

If all goes well, you will be met with the following sight:

```
┌─────────────┬────────┐
│ Status      |   DONE │
├─────────────┼────────┤
│ Parallelism    1     │
├─────────────┼────────┤
│ Duration     23.709  │
├─────────────┼────────┤
│ Timeout      120     │
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

This will show you on what hardware your app is running and what state it is in.

To find out which port your application are running on, run init-deployment again:

```
$ npm run xpr:init-deployment production
┌──────────┬──────────────────────────────────────┐
│ Key      │ Value                                │
├──────────┼──────────────────────────────────────┤
│ backends │ production.testapp                   │
├──────────┼──────────────────────────────────────┤
│ port     │ 1348                                 │
├──────────┼──────────────────────────────────────┤
│ acl      │ e1751731-58c1-2a83-13d3-485e5a9a1387 │
└──────────┴──────────────────────────────────────┘
Deployment group testapp-production (small) : NOT_MODIFIED
```

The above means that your application is available on: http://production.testapp.service.consul.xpr.dex.nu:1348.

#### 4. Access your app

##### www

You should now be able to access the www endpoint of your application, if you have one. The adress is on the format:
```
http://[environment].[your-app-name].service.consul.xpr.dex.nu/
```
For example "http://production.ursula.service.consul.xpr.dex.nu/".

If you need to target a specific container for your requests, add the header `X-Use-Backend: <host>`. This will work for all requests originating from our internal networks, internal requests will also include a header `X-Backend` containing the host that responded:
```
$ curl [environment].[your-app-name].service.consul.xpr.dex.nu/ -H "X-Use-Backend:xpr-x-xxxxxx" -I
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 162
ETag: W/"a2-6mYB55N2FatfgCGXbEYdxw"
Vary: Accept-Encoding
Date: Wed, 20 Jan 2016 15:02:48 GMT
X-Backend: xpr-x-xxxxxxx_20108
X-Request-ID: 0A1F66C9:C127_0A328C0B:0050_569FA198_0A9D:8CA4
```

##### ssh

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
$ ssh xpr-p-app105.sth.basefarm.net -l ad\\[your username]
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
root# su -s /bin/bash -l web
bash# pm2 list
...
bash# pm2 restart 1
```

#### 5. Further reading

##### Custom helios conf

Create your very own helios job config: [read more](README.md#helios-job-file-optional). For example, when:
* You want to check your app using some other enpoint than `/_alive`.
* You want to add a varnish cache.

##### Read list

* Salt - First endpoint in deployment chain, used for authentication and orchestration.
* Helios - All deployments are helios jobs. Deployment groups define where and how your app is deployed. 
* Consul - Once an app is deployed and running it is managed by consul for health checks and DNS/naming.
* PM2 - Used to keep your app alive inside the docker container.
