#!/usr/bin/env node

var _ = require('lodash'),
    fs = require('fs'),
    path = require('path'),
    colors = require('colors'),
    request = require('request'),
    prompt = require('prompt'),
    program = require('commander'),
    pkg = require('../package.json'),
    async = require('async'),
    readline = require("readline"),
    heliosJob = require('./helios-job.json'),
    exec = require('child_process').exec,
    Spinner = require('cli-spinner').Spinner,
    util = require('util'),
    Table = require('cli-table');

var tokenFile = process.env['HOME'] + '/.exp/salt-token';
var loglevel = process.env['npm_config_loglevel'];

function logVerbose(format, args) {
  if (loglevel === 'verbose' || loglevel === 'silly') {
    console.log(util.format(format, args));
  }
}

function loadRevision(cb) {
  exec('git rev-parse --short HEAD', function(err, stdout) {
    if (err) return cb(err);
    cb(null, { revision: _.trim(stdout) });
  });
}

function deleteAuthToken (cb) {
  fs.exists(tokenFile, function (exists) {
    if (exists) {
      fs.unlink(tokenFile, function (err) {
        if (err) return cb(err);
      });
    }
    cb(null, {});
  });
}

function loadJob(state, cb) {
  var jobFile = program.job || environmentConfig('helios_jobfile');
  if (jobFile) {
    fs.exists(jobFile, function (exists) {
      if (exists) {
        fs.readFile(jobFile, { encoding: 'utf8' }, function (err, data) {
          if (err) return cb(err);
          if (!program.nojobmerge && process.env['npm_package_config_exp_containership_nojobmerge'] !== 'true') {
            cb(null, _.assign(state, { job: _.merge(_.cloneDeep(heliosJob), JSON.parse(data)) }));
          } else {
            cb(null, _.assign(state, { job: JSON.parse(data) }));
          }
        });
      } else {
        cb(new Error('Job file could not be found'));
      }
    });
  } else {
    cb(null, _.assign(state, { job: heliosJob }));
  }
}

function loadCaCert(state, cb) {
  fs.readFile(program.ca, { encoding: 'utf8' }, function (err, data) {
    if (err) return cb(err);
    cb(null, _.assign(state, { ca: data }));
  });
}

function loadAuthToken (state, cb) {
  fs.exists(tokenFile, function (exists) {
    if (exists) {
      fs.readFile(tokenFile, { encoding: 'utf8' }, function (err, data) {
        if (err) return cb(err);
        cb(null, _.assign(state, { token: data }));
      });
    } else {
      cb(null, _.assign(state, { token: null }));
    }
  });
}

function login(state, cb) {
  if (_.isEmpty(state.token)) {
    prompt.start();
    prompt.message = '';
    prompt.delimiter = '';
    prompt.get([{
        description: 'Username:'.white,
        name: 'username',
        required: true
      }, {
        description: 'Password:'.white,
        name: 'password',
        required: true,
        hidden: true
      }], function (err, result) {
        if (err) return cb(err);
        request
          .post({ url: program.api + '/login', agentOptions: { ca: state.ca } })
          .form({ username: result.username, password: result.password, eauth: program.eauth })
          .on('response', function(response) {
            if (response.statusCode === 200) {
              cb(null, _.assign(state, { token: response.headers['x-auth-token'] }));
            } else {
              console.log('Unable to login, check your credentials'.red);
              login(state, cb);
            }
          }).on('error', cb);
      });
  } else {
    cb(null, state);
  }
}

function saveAuthToken(state, cb) {
  var dir = path.dirname(tokenFile);
  fs.mkdir(dir, function () {
    fs.writeFile(tokenFile, state.token, function (err) {
      if (err) return cb(err);
      cb(null, state);
    });
  });
}

function execSalt(saltFunction, saltArgs, ca, token, cb) {
    var spinner = new Spinner('Executing "' + saltFunction + '" (Ctrl-C to abort)');
  var agentOptions = {};
  if (!program.insecure && process.env['npm_package_config_exp_containership_insecure'] !== 'true') {
    agentOptions.ca = ca;
  }
  spinner.start();
  var req = {
    method: "POST",
    url: program.api,
    agentOptions: agentOptions,
    headers: {
      "X-Auth-Token": token,
      "Accept": "application/json"
    },
    json: {
      client: 'local',
      tgt: 'xpr-p-log103*',
      fun: saltFunction,
      arg: saltArgs
    }
  };
  logVerbose('Salt request: %s', [JSON.stringify(req, undefined, 2)]);
  request(req, function (err, response, body) {
    spinner.stop(true);
    if (err) return cb(err);
    if (response.statusCode === 200) {
      logVerbose('Salt response: %s', [JSON.stringify(body, undefined, 2)]);
      var result = body.return[0];
      cb(null, result[Object.keys(result)[0]]);
    } else if (response.statusCode === 401) {
      async.waterfall([deleteAuthToken, loadCaCert, login, saveAuthToken],
                      function (err, result) {
                        if (err) return cb(err);
                        execSalt(saltFunction, saltArgs, ca, result.token, cb);
                      });
    } else {
      cb(new Error('Unknown error returned by Salt API'));
    }
  });
}

function printTable(data, head) {
  var table = new Table(head ? {
    head: _.map(head, function (v) { return v.cyan; })
  } : {});

  if (_.isArray(data)) {
    _.each(data, function (v, k) {
      table.push(v);
    });
    console.log(table.toString());
  } else if (_.isObject(data)) {
    _.each(data, function (v, k) {
      var obj = {};
      obj[k.cyan] = v || "";
      table.push(obj);
    });
    console.log(table.toString());
  } else {
    console.log(data);
  }
}

function stateColor(state) {
  switch (state) {
    case 'PULLING_IMAGE':
    case 'PLANNING_ROLLOUT':
    case 'ROLLING_OUT':
    case 'HEALTHCHECKING':
    case 'STARTING':
    case 'NOT_MODIFIED':
      return state.yellow;
    case 'DEPLOYMENT_GROUP_NOT_FOUND':
    case 'STOPPED':
    case 'FAILED':
    case 'CONFLICT':
      return state.red;
    default:
      return (state || '').green;
  }
}

function environmentConfig(config) {
  return process.env['npm_package_config_exp_containership_environments_' +
          program.environment + '_' + config];
}

function serviceUrl(app) {
  return util.format('http://%s.%s.service.consul.xpr.dex.nu', program.environment, app);
}

var tasks = [loadRevision, loadCaCert, loadAuthToken, login, saveAuthToken, loadJob];

function errExit(msg) {
  console.error(("ERROR: " + msg).red);
  process.exit(1);
}

// TODO rename
function ensure_app(app) {
  var app = app || process.env['npm_package_name'];
  if (!app) {
    errExit("App name not defined");
  }
  return app;
}

function ensure_group(app, group) {
  var envGroup = environmentConfig('helios_deployment_group');
  if (!group && !envGroup && !program.environment) {
    errExit("Deployment group not defined");
  }
  return group || envGroup || ensure_app(app) + "-" + program.environment;
}

function ensure_deployment_size() {
  var envDeploymentSize = environmentConfig('size');
  return envDeploymentSize || "small";
}

function jobName(app, env, rev) {
  return app + '-' + env + ":" + rev;
}

program
  .command('status [group]')
  .description('prints the deployment group status')
  .action(function (group) {
    group = ensure_group(null, group);
    tasks.push(function (state, cb) {
      execSalt('xpr-deploy.status',[group], state.ca, state.token, function (err, result) {
        if (err) return cb(err);
        printTable({
          Status: result.status,
          Name: _.get(result, "deploymentGroup.name"),
          "Job Id": _.get(result, "deploymentGroup.jobId")
        });
        printTable(_.map(result.hostStatuses, function (s) {
          return [s.host, (s.jobId || ''), stateColor(s.state)];
        }), ['Host','Job ID','State']);
      });
    });
  });

program
  .command('init-deployment [app]')
  .description('Create Consul configuration and Helios deployment group')
  .action(function (app) {
    app = ensure_app(app);
    group = ensure_group(app, null);
    size = ensure_deployment_size();
    tasks.push(function (state, cb) {
      execSalt('xpr-deploy.consul_config',[app, program.environment], state.ca, state.token, function (err, result) {
        if (err) return cb(err);
        console.log("Consul config:");
        result = JSON.parse(result);
        printTable(_.forEach(result, function (v, k) {
          return [v];
        }), ['Key','Value']);
      });
      execSalt('xpr-deploy.create_deployment_group',[group, program.environment, size], state.ca, state.token, function (err, result) {
        if (err) return cb(err);
        console.log("Helios deployment group:");
        var tbl = {};
        tbl[group] = [stateColor(result.status), size];
        printTable(tbl, ["Name", "State", "Size"]);
        console.log("Url: http://" + program.environment + "." + app + ".service.consul.xpr.dex.nu:80 (also \"Port\" above).");
      });
    });
  });

program
  .command('jobs [revision] [app]')
  .description('lists all jobs for the deployment group')
  .action(function (rev, app) {
    app = ensure_app(app) + '-' + program.environment;
    if (!_.isEmpty(rev)) {
      app = app + ':' + rev;
    }
    tasks.push(function (state, cb) {
      execSalt('xpr-deploy.jobs', [app], state.ca, state.token, function (err, jobs) {
        if (err) return cb(err);
        var table = _.map(jobs, function (job) {
          var jobEnv =  _.map(job.env, function (v, e) {return e.yellow + '=' + v;}).join('\n');
          return [job.id, job.image, jobEnv];
        });
        printTable(table, ['Id', 'Image', 'Environment']);
        cb(null, state);
      });
    });
  });

program
  .command('open [app]')
  .description('open the specified app environment in a browser')
  .action(function (app) {
    app = ensure_app(app);
    tasks = [function (cb) {
      exec('open ' + serviceUrl(app), cb);
    }];
  });

program
  .command('deploy [revision] [app] [group]')
  .description('deploys the specified revision to an environment')
  .action(function (rev, app, group) {
    app = app || process.env['npm_package_name'];
    tasks.push(function (state, cb) {
      var imageUrl = "https://" + program.repository + "/v2/" + app + "/manifests/" + state.revision;
      request(imageUrl, function (err, resp) {
        if (err || resp.statusCode !== 200) {
          // No image in repo lets push one, if it fails this call will throw.
          console.log("Image not found - " + imageUrl + ": " + (err || resp.statusCode) + ", building image and pushing to repo");
          var contCmd = __dirname + "/exp-containership.sh";
          var cmd = exec(contCmd + " build && " + contCmd + " push", function  (error, stdout, stderr) {
            cb(error, state);
          });
          cmd.stdout.pipe(process.stdout);
          return;
        }
        cb(null, state);
      });
    });

    tasks.push(function (state, cb) {
      app = ensure_app(app);
      group = ensure_group(app, group);
      rev = rev || state.revision;

      var job = _.merge({
        env: {
          SERVICE_NAME: app,
          SERVICE_TAGS: rev + ',' + program.environment,
          NODE_ENV : program.environment,
          VERSION: rev,
          DEPLOYMENT_USER: program.user,
          DEPLOYMENT_DATE: new Date()
        },
        volumes: {
          "/exp-container/logs:rw" : path.join('/var/log/containers', program.environment, app),
          "/exp-container/data:rw" : path.join('/var/lib/containers', program.environment, app),
          "/root/.pm2/logs:rw" : path.join('/var/log/containers', program.environment, app),
          "/home/web/.pm2/logs:rw" : path.join('/var/log/containers', program.environment, app)
        }
      }, state.job);
      var jobId = jobName(app, program.environment, rev);
      var image = program.repository + '/' + app + ':' + rev;
      var jobDef = new Buffer(JSON.stringify(job)).toString('hex');
      var saltArgs = [app, program.environment, rev, jobDef, image, group, program.user];
      logVerbose("Job def: ", JSON.stringify(job, null, 2));
      execSalt('xpr-deploy.deploy_async', saltArgs, state.ca, state.token, function (err, result) {
        if (err) return cb(err);
        printTable({result: stateColor(result.status)});
        if (result.status === "OK") {
          waitForDeploy(jobId, group, state.ca, state.token, undefined, cb);
        } else {
          cb();
        }
      });
    });
  });

function waitForDeploy(jobId, group, ca, token, lastResult, cb) {
  if (lastResult) {
    printTable(_.map(lastResult.hostStatuses, function (s) {
      if (_.startsWith(s.jobId, jobId)) {
        s.stateColor = stateColor(s.state);
      } else {
        s.stateColor = (s.state || '').grey;
        s.jobId =(s.jobId || '').grey;
        s.host = s.host.grey;
      }
      return [s.host, (s.jobId || ''), s.stateColor];
    }), ['Host','Job ID','State']);

    var finished = _.filter(lastResult.hostStatuses, function(s) {
      return _.startsWith(s.jobId, jobId) && s.state === "RUNNING";
    });
    if (finished.length >= lastResult.hostStatuses.length) {
      return cb();
    }
  }
  var wait = lastResult ? 1500 : 0;
  setTimeout(function () {
    execSalt('xpr-deploy.status',[group], ca, token, function (err, result) {
      if (err) return cb(err);
      clearLines(lastResult ? 3 + 2 * lastResult.hostStatuses.length : 0);
      waitForDeploy(jobId, group, ca, token, result, cb);});
  }, wait);
}

function clearLines(n) {
  _.times(n, function () {
    readline.clearLine(process.stdout, 0);
    readline.moveCursor(process.stdout, 0, -1);
  });
  readline.clearLine(process.stdout, 0);
  readline.cursorTo(process.stdout, 0);
}

program
  .command('undeploy [revision] [app] [group]')
  .description('undeploys the job from the specified environment')
  .action(function (rev, app, group) {
    tasks.push(function (state, cb) {
      app = ensure_app(app);
      group = ensure_group(app, group);
      rev = rev || state.revision;
      execSalt('xpr-deploy.undeploy', [group, program.user], state.ca, state.token, function (err) {
        if (err) return cb(err);
        console.log("Undeploy finished. Reply from backend was: GR8 SUCCESS");
        cb(null, state);
      });
    });
  });

program
  .command('restart [env] [node]')
  .description('restarts a container in the specified environment and on the specified node')
  .action(function (env, node) {
    tasks.push(function (state, cb) {
      app = ensure_app(undefined);
      execSalt('xpr-deploy.restart', [app, env, node], state.ca, state.token, function (err, status) {
        if (err) return cb(err);
        if (status["error"]) {
          console.log("Restart failed. Reply from backend was: " + status["error"]);
        } else {
          console.log("Restart finished. Reply from backend was: " + status["message"]);
        }
        cb(null, state);
      });
    });
  });

program
  .version(pkg.version)
  .option('-e, --environment <name>', 'the environment to run against', 'production')
  .option('-a, --api <url>', 'the salt stack api endpoint url', process.env['npm_package_config_exp_containership_salt'] || 'https://salt-api.service.consul.xpr.dex.nu')
  .option('-t, --eauth <name>', 'Salt eauth type, typically pam or ldap (default: ldap)', process.env['npm_package_config_exp_containership_eauth'] || 'ldap')
  .option('-u, --user <user>', 'the user to impersonate', process.env['USER'])
  .option('-r, --repository <address>', 'the docker repository address', process.env['npm_package_config_exp_containership_repo'] || 'exp-docker.repo.dex.nu')
  .option('-j, --job <file>', 'the helios job file to deploy')
  .option('-n, --nojobmerge', 'do not merge the helios jobfiles, use the custom job only')
  .option('-c, --ca <path>', 'the CA cert used to validate the API endpoint', process.env['npm_package_config_exp_containership_ca'] || path.resolve(__dirname, '../ca/salt.ca'))
  .option('-k, --insecure', 'skip CA cert validation against the API endpoint')
  .parse(process.argv);

if (process.argv.length <= 2) {
  return program.help();
} else {
  async.waterfall(tasks, function (err, state) {
    if (err) {
      console.log(err.toString().red);
      process.exit(1);
    }
  });
}
