# Development super fun with exp-containership 

How to get your node.js app up and running in a docker container on your development Mac.

#### 1. Make sure you have everything you need

* Your computer should have an apple on it.
* If you have previosly installed VirtualBox and/or docker, uninstall all such software and reboot.
* You have an node-starter-app based node app you want to dockerify.

#### 2. Install the exp-containership module

```
% cd [the-app-you-want-to-dockerize]
% npm install exp-containership --save-dev
```

#### 3. Bootstrap docker stuff
In the same folder, issue:

```
% node_modules/.bin/exp-containership init
```

Exp-containership will notice you don't have docker installed and open up a tab in your browser with download instructions.
After everything is installed (it will take a while...), run the command again:

```
% node_modules/.bin/exp-containership init
```

This should leave you with two new files: `Dockerfile` and `docker-compose.yml`.

#### 4. Link external services (optional)

If your app depends on external services (rabbitmq, elasticsearch, mongodb etc), these must also
run in docker containers. We are using the tool 'docker-compose' to manage
development machine environments, so we'll need a few new entries in your `docker-compose.yml` file:

```
web:

  ...

  environment:
    
    ...

    - ALLOW_TEST_ENV_OVERRIDE=true
    - rabbit.host=linked-rabbitmq
    - elasticsearch.hosts=linked-elasticsearch:9200

  ...

  links:
    - elasticsearch:linked-elasticsearch
    - rabbitmq:linked-rabbitmq
    
elasticsearch:
  image: elasticsearch:1.7.1
  command: bash -c "plugin --silent install elasticsearch/elasticsearch-analysis-icu/2.7.0 && gosu elasticsearch elasticsearch"
  ports:
    - "9200:9200"
  
rabbitmq:
  image: rabbitmq:3.5-management
  ports:
    - "5672:5672"
    - "15672:15672"
```

What we have done here is:

* Added two additional containers "elasticsearch" and "rabbitmq", in addition to the main container
that was already present (called 'web')
* The "web" container can access "elasticseach" and "rabbitmq" thanks to the "links" property.
"elasticsearch" can be reached under the hostname "linked-elasticsearch", "rabbit" can be reached via
the hostname "linked-rabbitmq".
* We have also added new environment variables in the "web" container so that exp-config will use the correct
hostname for the concerned services.

NOTE: The "compose" tool and all settings above are only used when running your dockerified app locally. Once your app is deployed to an actual environment, none of this stuff is used.

#### 5. Scripts, script, scripts

The time is here to add a few new script targets to your `package.json`.
Open your editor of choice and add:

```json
"scripts": {
  "xpr:start": "exp-containership run",
  "xpr:open": "exp-containership open",
  "xpr:test": "exp-containership test",
  "xpr:shell": "exp-containership exec web bash"
}
```

#### 6. Get going

##### Run the app ...

```
$ npm run xpr:start
```

Now:

* Your app and any external services defined are started as docker containers.
* Your app is started using pm2 inside the "web" container.
* Your local project folder is magically linked into the "web" docker container. If you edit the code/config on your local hard drive, the app will be automatically restarted thanks to the
pm2 "watch" feature.

##### ... or test the app ...

```
$ npm run xpr:test
```

This will start the app and external services, then run the "npm test" target inside the "web"
container.

##### ... or open your app's web interface in your browser ...

```
$ npm run xpr:open
```

This will figure out the ip adress and port of your dockerized app and open it up in a new tab in your browser.

##### ... or get a shell and do whatever you like

```
$ npm run xpr:shell
```

This will build/start the container and external services, and give you a shell in the "web" container where you can do
anything you desire. Your node app can be found under '/exp-container/app', start by going there
and doing an 'npm install'.

#### 7. More info

##### Custom pm2 config 

Create your own pm2 config files: [read more](README.md#custom-pm2-config-optional). For example, when:
* Your app needs to start a background worker process of some sort.
* Your apps main script has a different name than 'app.js'
* You want to use pm2 in some other special way.

##### Read list

Some of the technologies behind the scenes:

* https://docs.docker.com/engine/userguide/ - Docker user guide
* https://docs.docker.com/compose/ - Compose docs
* https://github.com/Unitech/pm2 - PM2 Docs

#### 8. Troubleshooting

It might not be your fault when stuff goes wrong. Sometimes Docker gets confused, and you need to tell it to get it's stuff together again.

First, try restarting the docker machine:

```
$ docker-machine restart exp-docker
```

This operation is fairly quick and usually resolves the problem if Docker has gotten in a state of confusion.

If nothing else helps you can try this (in your applications root folder) as a last resort:

```
$ ./node_modules/.bin/exp-containership reset
```

This removes the entire virtual that hosts your docker containers, so it will take quite some time to build your project afterwards as images must be downloaded again.


