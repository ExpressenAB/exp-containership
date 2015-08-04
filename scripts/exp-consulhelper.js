#!/usr/bin/env node
var consul = require('consul')({host: "10.200.1.65", port: 8500});


if (process.argv.length <= 2) {
    console.log("Usage: " + __filename + " ACTION MESSAGE");
    process.exit(1);
}
var action = process.argv[2];
var message = process.argv[3];

console.log(message);


var appName = process.env["npm_package_name"];
var deployUser = process.env["USER"];

consul.event.fire({name: 'deploy', payload: new Date().toISOString() + ": " + appName + ": " + message + " (" + deployUser + ")", service: appName}, function(err, result) {
  if (err) throw err;
  //console.log(result);
});

setTimeout(function () {
	consul.event.list("deploy", function(err, result) {
	  if (err) throw err;
	  console.log(result);
	});
}, 1000);




