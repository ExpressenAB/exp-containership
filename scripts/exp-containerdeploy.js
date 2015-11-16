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
    messages = require('./messages.js'),
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
    if (err) {
      cb(err);
    } else {
      cb(null, { revision: _.trim(stdout) });
    }
  });
}

function deleteAuthToken (cb) {
  fs.exists(tokenFile, function (exists) {
    if (exists) {
      fs.unlink(tokenFile, function (err) {
        if (err) {
          cb(err);
        } else {
          cb(null, {});
        }
      });
    } else {
      cb(null, {});
    }
  });
}

function loadJob(state, cb) {
  var jobFile = program.job || environmentConfig('helios_jobfile');
  if (jobFile) {
    fs.exists(jobFile, function (exists) {
      if (exists) {
        fs.readFile(jobFile, { encoding: 'utf8' }, function (err, data) {
          if (err) {
            cb(err);
          } else {
            if (!program.nojobmerge && process.env['npm_package_config_exp_containership_nojobmerge'] !== 'true') {
              cb(null, _.assign(state, { job: _.merge(_.cloneDeep(heliosJob), JSON.parse(data)) }));
            } else {
              cb(null, _.assign(state, { job: JSON.parse(data) }));
            }
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
    if (err) {
      cb(err);
    } else {
      cb(null, _.assign(state, { ca: data }));
    }
  });
}

function loadAuthToken (state, cb) {
  fs.exists(tokenFile, function (exists) {
    if (exists) {
      fs.readFile(tokenFile, { encoding: 'utf8' }, function (err, data) {
        if (err) {
          cb(err);
        } else {
          cb(null, _.assign(state, { token: data }));
        }
      });
    } else {
      cb(null, _.assign(state, { token: null }))
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
        if (err) {
          cb(err);
        } else {
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
            })
            .on('error', cb);
        }
      });
  } else {
    cb(null, state);
  }
}

function saveAuthToken(state, cb) {
  var dir = path.dirname(tokenFile);
  fs.mkdir(dir, function () {
    fs.writeFile(tokenFile, state.token, function (err) {
      if (err) {
        cb(err);
      } else {
        cb(null, state);
      }
    });
  });
}

function execOrchestrate(options, cb) {
  var message = messages.randomMessage();
  var spinner = new Spinner('Please wait -- ' + message +
        (_.endsWith(message, '?') || _.endsWith(message, '!') ? ' %s' : '... %s'));
  var agentOptions = {};
  if (!program.insecure && process.env['npm_package_config_exp_containership_insecure'] !== 'true') {
    agentOptions.ca = options.ca;
  }
  logVerbose('Orchestrate request: %s', [JSON.stringify(options.body, undefined, 2)]);
  spinner.start();
  request({
    method: "POST",
    url: program.api,
    agentOptions: agentOptions,
    headers: {
      "X-Auth-Token": options.token,
      "Accept": "application/json"
    },
    json: options.body
  }, function (err, response, body) {
    spinner.stop(true);
    if (err) {
      logVerbose('Orchestrate error: %s', [err]);
      if (err.code == 'ECONNREFUSED') {
        cb(new Error('Error contacting the Salt API endpoint'));
      } else {
        cb(err);
      }
    } else if (response.statusCode === 200) {
      logVerbose('Orchestrate response: %s', [JSON.stringify(body, undefined, 2)]);
      var ret = _.first(body.return);
      var node = _.first(_.values(_.first(_.values(ret))));
      var changes = node.changes;

      if (!changes) {
        return cb(new Error(JSON.stringify(node)));
      }

      var results = _.map(changes.ret, function (v, k) {
        try {
          return JSON.parse(v);
        } catch (e) {
          return v;
        }
      });
      cb(null, _.assign(options, {
        body: body,
        results: results,
        response: response
      }));
    } else if (response.statusCode === 401) {
      async.waterfall([deleteAuthToken, loadCaCert, login, saveAuthToken],
        function (err, result) {
          if (err) {
            cb(err);
          } else {
            execOrchestrate(_.assign(options, { token: result.token }), cb);
          }
        });
    } else {
      cb(new Error('Unknown error returned by API'));
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
      return state.yellow;
    case 'DEPLOYMENT_GROUP_NOT_FOUND':
    case 'STOPPED':
    case 'FAILED':
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

program
  .command('status [group]')
  .description('prints the deployment group status')
  .action(function (group, options) {
    group = ensure_group(null, group);

    tasks.push(function (state, cb) {
      execOrchestrate(_.assign(state, {
        body: {
          client: 'runner',
          fun: 'state.orchestrate',
          mods: 'orchestrate.status_helios_deployment_group',
          pillar: {
            deploymentGroup: group
          }
        }
      }), function (err, state) {
        if (err) {
          cb(err);
        } else {
          _.each(state.results, function (result) {
            var status = result.deploymentGroupStatus;
            if (status) {
              var appName = result.deploymentGroup.name.substring(0, result.deploymentGroup.name.lastIndexOf('-'));
              printTable({
                Name: result.deploymentGroup.name,
                URL: serviceUrl(appName),
                "Host Selectors": _(_.map(result.deploymentGroup.hostSelectors, function (v) {
                  return v.label + ' ' + v.operator.yellow + ' ' + v.operand;
                })).join('\n'),
                "Job ID": result.deploymentGroup.jobId,
                State: stateColor(status.state)
              });

              printTable(_.map(result.hostStatuses, function (s) {
                return [s.host, (s.jobId || ''), stateColor(s.state)];
              }), ['Host','Job ID','State']);
            } else {
              cb(new Error('Invalid deployment group: ' + group));
            }
          });

          cb(null, state);
        }
      });
    });
  });

function errExit(msg) {
  console.error(("ERROR: " + msg).red);
  process.exit(1);
}

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

program
  .command('jobs [revision] [app]')
  .description('lists all jobs for the deployment group')
  .action(function (rev, app, options) {
    app = ensure_app(app);

    if (!_.isEmpty(rev)) {
      app = app + ':' + rev;
    }

    tasks.push(function (state, cb) {
      execOrchestrate(_.assign(state, {
        body: {
          client: 'runner',
          fun: 'state.orchestrate',
          mods: 'orchestrate.get_helios_job',
          pillar: {
            deployUser: program.user,
            appName: app
          }
        }
      }), function (err, state) {
        if (err) {
          cb(err);
        } else {
          //console.log(JSON.stringify(state.results));
          printTable(_.flatten(_.map(state.results, function (result) {
            var jobs = _.values(result);

            return _.map(jobs, function (job) {
              return [
                job.id,
                _(_.map(job.ports, function (port, name) {
                  return name.yellow + '=' +
                    (port.externalPort || '<auto>') + ':' +
                    port.internalPort + '/' +
                    port.protocol;
                })).join('\n'),
                job.image,
                _(_.map(job.env, function (v, env) {
                  return env.yellow + '=' + v
                })).join('\n'),
              ];
            });
          })), ['ID', 'Ports', 'Image', 'Environment']);
          cb(null, state);
        }
      });
    });
  });

function jobName(app, env, rev) {
  return app + '-' + env + ":" + rev;
}

program
  .command('open [group]')
  .description('open the specified deployment group in a browser')
  .action(function (group) {
    group = ensure_group(null, group);
    var appName = group.substring(0, group.lastIndexOf('-'));
    tasks = [function (cb) {
      exec('open ' + serviceUrl(appName), function (err) {
        cb(err);
      });
    }];
  });

program
  .command('deploy [revision] [app] [group]')
  .description('deploys the specified revision to an environment')
  .action(function (rev, app, group, options) {
    app = app || process.env['npm_package_name'];
    tasks.push(function (state, cb) {
      var imageUrl = "https://" + program.repository + "/v1/repositories/" + app + "/tags/" + state.revision;
      request(imageUrl, function (err, resp) {
        if (err || resp.statusCode !== 200) {
          // No image in repo lets push one, if it fails this call will throw.
          console.log("Image not found - " + imageUrl + ": " + (err || resp.statusCode) + ", building image and pushing to repo");
          var contCmd = __dirname + "/exp-containership.sh";
          var cmd = exec(contCmd + " build && " + contCmd + " push", function  (error, stdout, stderr) {
            cb(null, state);
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
          VERSION: rev
        },
        volumes: {
          "/exp-container/logs:rw" : path.join('/var/log/containers', program.environment, app),
          "/root/.pm2/logs:rw" : path.join('/var/log/containers', program.environment, app)
        }
      }, state.job);
      logVerbose("Helios job def: " + JSON.stringify(job, undefined, 2));
      execOrchestrate(_.assign(state, {
        body: {
          client: 'runner',
          fun: 'state.orchestrate',
          mods: 'orchestrate.create_helios_job',
          pillar: {
            name: app,
            job: jobName(app, program.environment, rev),
            deployUser: program.user,
            image: program.repository + '/' + app + ':' + rev,
            job_def: new Buffer(JSON.stringify(job)).toString('base64'),
            env: {}
          }
        }
      }), function (err, state) {
        if (err) {
          cb(err);
        } else {
          cb(null, state);
        }
      });
    });

    tasks.push(function (state, cb) {
      app = ensure_app(app);
      rev = rev || state.revision;
      execOrchestrate(_.assign(state, {
        body: {
          client: 'runner',
          fun: 'state.orchestrate',
          mods: 'orchestrate.deploy_helios',
          pillar: {
            job: jobName(app, program.environment, rev),
            deployUser: program.user,
            deploymentGroup: group
          }
        }
      }), function (err, state) {
        if (err) {
          cb(err);
        } else {
          _.each(state.results, function (result) {
            printTable({
              Status: stateColor(result.status),
              Parallelism: result.parallelism,
              Duration: result.duration,
              Timeout: result.timeout
            });
          });

          cb(null, state);
        }
      });
    });
  });

program
  .command('undeploy [revision] [app] [group]')
  .description('undeploys the job from the specified environment')
  .action(function (rev, app, group, options) {
    tasks.push(function (state, cb) {
      app = ensure_app(app);
      group = ensure_group(app, group);
      rev = rev || state.revision;

      execOrchestrate(_.assign(state, {
        body: {
          client: 'runner',
          fun: 'state.orchestrate',
          mods: 'orchestrate.undeploy_helios_job',
          pillar: {
            job: jobName(app, program.environment, rev),
            deployUser: program.user,
            deploymentGroup: group
          }
        }
      }), function (err, state) {
        if (err) {
          cb(err);
        } else {
          _.each(state.results, function (r) {
            console.log(r.green);
          });
          cb(null, state);
        }
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
