#!/usr/bin/env node

//var config = require("package").config;

//console.log(config);
var _ = require('lodash-node');
var util = require("util");
var fs = require("fs");
var path = require("path");
var colors = require('colors');
var prettyjson = require('prettyjson');
var caCertFile = path.resolve(__dirname, "../ca/salt.ca");
var request = require("request");
var prompt = require("prompt");
var Spinner = require('cli-spinner').Spinner;
var EventEmitter = require('events').EventEmitter;

//require('request').debug = true

var emitter = new EventEmitter();
var token;
var tokenFile = "/tmp/salt-token";
var appName = process.env["npm_package_name"];
var deployUser = process.env["USER"];
var currDir = process.env["PWD"];
var heliosJobFile = process.env["npm_package_config_exp_containership_production_helios_jobfile"];
var dockerRepo = process.env["npm_package_config_exp_containership_repo"]

var heliosJob = fs.readFileSync(currDir + "/" + heliosJobFile);
var heliosJobJSON = JSON.parse(heliosJob);

if (process.argv.length <= 4) {
    console.log("Usage: " + __filename + " ACTION ENV REV");
    process.exit(1);
}
var action = process.argv[2];
var environment = process.argv[3];
var rev = process.argv[4];

var deployJob = {
  "client": "runner",
  "fun": "state.orchestrate",
  "mods": "orchestrate.deploy_helios",
  "pillar": {
    "job": appName + ":" + rev,
    "deployUser": deployUser,
    "token": rev,
    "image": dockerRepo + "/" + appName + ":" + rev,
    "job_def": heliosJobJSON,
    "deploymentGroup": appName,
    "env": {
      "SERVICE_NAME": appName,
      "SERVICE_TAGS": rev + "," + environment + ";",
      "NODE_ENV" : environment,
      "VERSION": rev
    }
  }
};

var undeployJob = {
  "client": "runner",
  "fun": "state.orchestrate",
  "mods": "orchestrate.undeploy_helios_job",
  "pillar": {
    "job": appName + ":" + rev,
    "deployUser": deployUser,
    "token": rev,
    "deploymentGroup": appName
  }
};

var statusJob = {
  "client": "runner",
  "fun": "state.orchestrate",
  "mods": "orchestrate.status_helios_deployment_group",
  "pillar": {
    "job": appName + ":" + rev,
    "deployUser": deployUser,
    "token": rev,
    "deploymentGroup": appName
  }
};

var getJob = {
  "client": "runner",
  "fun": "state.orchestrate",
  "mods": "orchestrate.get_helios_job",
  "pillar": {
    "job": appName + ":" + rev,
    "deployUser": deployUser,
    "token": rev,
    "deploymentGroup": appName,
    "appName": appName
  }
};


var jobs = {
  "deploy": deployJob,
  "undeploy": undeployJob,
  "status": statusJob,
  "jobs": getJob
};

var spinner = new Spinner("Running: " + action + " for " + appName +" in " + environment + ".. %s");
spinner.setSpinnerString('|/-\\');

emitter.on("prompt", function() {
  prompt.start();
  prompt.message = "exp-containership".green;
  prompt.delimiter = ":".white;
  prompt.get([{
      name: "username",
      required: true
    }, {
      name: "password",
      required: true,
      hidden: true
    }], function (err, result){
    emitter.emit("get_token", result.username, result.password);
  });
});

emitter.on("get_token", function(username, password) {
  request
    .post({url: 'https://localhost:8000/login', agentOptions: {ca: fs.readFileSync(caCertFile)}})
    .form({username: username, password: password, eauth: 'pam'})
    .on('response', function(response) {
      if (response.statusCode === 200) {
        token = response.headers["x-auth-token"];
        console.log(token);
        fs.writeFileSync(tokenFile, token);
        emitter.emit(jaction, token, heliosJobJSON);
      } else {
        console.log("Unable to login, check your credentials");
        process.exit(1);
      }
    });
});

emitter.on(action, function (token, heliosJobJSON) {
  spinner.start();
  request({
    method: "POST",
    url: "https://localhost:8000/",
    agentOptions: {ca: fs.readFileSync(caCertFile)},
    headers: {
      "X-Auth-Token": token,
      "Accept": "application/json"
    },
    json: jobs[action]
  }, function (error, response, body) {
    if (error)
      if (error.code == "ECONNREFUSED") {
        console.log("Error contacting the Salt API endpoint");
        process.exit(1);
      }
    spinner.stop();
    process.stdout.write('\n');
    if (response.statusCode === 200) {
      emitter.emit("handle_response", response, body);
    } else {
      spinner.stop();
      process.stdout.write('\n');
      fs.unlinkSync(tokenFile);
      console.log("Unable to deploy: " + body);
      process.exit(1);
    }
    //console.log(JSON.parse(response));
  });
});

emitter.on("handle_response", function(response, body){
  _.forIn(body.return[0], function (value, key) {
    _.forIn(body.return[0][key], function (v, k){
      console.log("----------- Salt: ".red + k.green + " -----------".red);
      console.log("- Result: ".red + v.result);
      console.log("- Output: ".red);
      if (v.changes.ret[Object.keys(v.changes.ret)[0]]) {
        try {
          console.log(prettyjson.render(JSON.parse(v.changes.ret[Object.keys(v.changes.ret)[0]])));
        } catch (e) {
          console.log(v.changes.ret[Object.keys(v.changes.ret)[0]].green);
        }
      }
    });
  });
});

try {
  var tokenFileStats = fs.lstatSync(tokenFile).isFile();
  token = fs.readFileSync(tokenFile);
  emitter.emit(action, token, heliosJobJSON);
} catch (e) {
  if (e.code === 'ENOENT') {
    emitter.emit("prompt");
  } else {
    console.log(e);
    process.exit(1);
  }
}

// helios --json create testjob:4 exp-docker.repo.dex.nu/jtp:0230154 --env SERVICE_NAME=jtp --env SERVICE_TAGS=773a89e,production,exp-exporter --env NODE_ENV=production --http-check http:/_alive -p http=3000 -u magbenex

//request.post;