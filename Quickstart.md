# Exp-containership dev env quick start

How to get your node.js app up and running in a docker container on your development Mac.

## 1. Make sure you have everything you need

* Your computer should have an apple on it.
* If you have previosly installed VirtualBox and/or docker, uninstall all such software and reboot.
* You have an node-starter-app based node app you want to dockerify.

## 2. Install the node module in your app

```
% cd [the-app-you-to-dockerize]
% npm install exp-containership --save-dev
```

## 3. Bootstrap docker stuff
In the same folder, issue:

```
% node_modules/.bin/exp-containership init
```

This should exit with an error message telling you how to install docker software.
After everything is installed, run the command again:

```
% node_modules/.bin/exp-containership init
```

This should leave you with two new files: `Dockerfile` and `docker-compose.yml`.

## 4. Link external services (optional)

If your app depends on external services (rabbitmq, elasticsearch, mongodb etc), these must also
run in docker containers. We are using the tool `docker-compose' to manage
development machine environments, so we'll need a few new entries in your docker-compose.yml file:

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

* Added two additional containers 'elasticsearch' and 'rabbitmq', in addition to the main container
that was already present (called 'web')
* The 'web' container can access 'elasticseach' and 'rabbitmq' thanks to the 'links' property.
'elasticsearch' can be reached under the hostname 'linked-elasticsearch', 'rabbit' can be reached via
the hostname 'linked-rabbitmq'.
* We have also added new environment variables in the 'web' container so that exp-config will use the correct
hostname for the concerned services.

## 5. Scripts, script, scripts

The time is here to add a few new script targets to your `package.json`.
Open your editor of choice and add:

```
json
"scripts": {
  "xpr:start": "exp-containership run",
  "xpr:open": "exp-containership open",
  "xpr:test": "exp-containership test",
  "xpr:shell": "exp-containership exec web bash"
}
```

# 6. Get running

## Run the app ...

```
$ npm run xpr:start
```

Now:

* Your app and any external services defined are started inside docker containers.
* Your app will run using pm2 inside the container.
* Your local project folder is magically linked into the docker container. If you edit your
code/config on your local hard drive, the app will be automatically restarted thanks to the
pm2 'watch' feature/

## ... or test the app ...

```
$ npm run xpr:test
```

This will start the app and external services, then run the 'npm test` target inside the 'web'
container.

## .. or get a shell and do whatever you like

```
$ npm run xpr:shell
```

This will build/start the container and external services, and give you a shell where you can do
anything you desire. Your node app can be found under '/exp-container/app', start by going there
and doing an 'npm install'.

# 7. Further reading

More info on the technologies behind the scenes.

* https://docs.docker.com/engine/userguide/ - Docker user guide
* https://docs.docker.com/compose/ - Compose docs
* https://github.com/Unitech/pm2 - PM2 Docs