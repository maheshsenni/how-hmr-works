var mdeps = require('module-deps');
var browserPack = require('browser-pack');
var JSONStream = require('JSONStream');
var fs = require('fs');
var path = require('path');
// express - for serving our app
var express = require('express');
var app = express();
var http = require('http').Server(app);
// websocket connection for notifying browser
var io = require('socket.io')(http);

// parse arugments to get entry point file name and path
var args = process.argv.slice(2);
var entryPointFile;
if (args.length <= 0) {
  // check if entry point file is specified when running the command
  console.log('Specify an entry point file');
  process.exit(1);
} else {
  // store the entry point file
  entryPointFile = args[0];
}

// browser-pack custom prelude options
var preludePath = path.join(__dirname, 'lib/browser-pack-prelude.js');
var prelude = fs.readFileSync(preludePath, 'utf8');

// to store output from module-deps for
// use in /hot-update endpoint
var moduleDepsJSONStr;
var moduleDepsJSON;
// hold bundle ouput until written to a file
var bundleStr;


var processModuleDepsStr = function(str) {
  // since JSON is from stream, we need to store
  // it in a variable until the end of the stream is reached
  moduleDepsJSONStr += str;
};

var processModuleDepsEnd = function(str) {
  // Once we have the complete JSON, parse and store it
  // for future use
  moduleDepsJSON = JSON.parse(moduleDepsJSONStr);
};

var processBundleStr = function(data) {
  // store the bundle output until the stream
  // is completely processed
  bundleStr += data;
};

// Let's keep the bundle creation in a separate function
// which will come in handy when we invoke this whenever
// a file changes
var processFiles = function(callback) {
  // invoke module-deps by passing in the entry point file
  md = mdeps();
  moduleDepsJSONStr = '';
  bundleStr = '';
  md.pipe(JSONStream.stringify())
  .on('data', processModuleDepsStr)
  .on('end', processModuleDepsEnd)
  .pipe(browserPack({ preludePath: preludePath, prelude: prelude }))
  .on('data', processBundleStr)
  .on('end', function() {
    fs.writeFile('dist/bundle.js', bundleStr, 'utf8', function() {
      console.log('Bundle file written...');
      if (typeof callback === 'function') {
        callback();
      }
    });
  });

  md.end({ file: path.join(__dirname, args[0]) });
};

// Call the function to create the bundle for the first time
processFiles();

// watch app folder for changes
fs.watch('app', function(event, fileName) {
  // create bundle with new changes
  processFiles(function() {
    // notify the browser of the change
    io.emit('file-change', { id: path.join(__dirname, 'app', fileName) });
  });
});

// configure express to serve contents of 'dist' folder
app.use('/', express.static('dist'));

// response with a JSONP callback function which does hot module replacement
app.get('/hot-update', function(req, res){
  var moduleId = req.query.id;
  // wrap the module code around JSONP callback function
  var hotUpdateScriptTxt = 'hotUpdate({ "' + moduleId + '":[function(require,module,exports){';
  // find the updated module in moduleDepsJSON (output from module-deps)
  var updatedModule = moduleDepsJSON.filter(function(dep) {
    return dep.id === moduleId;
  })[0];
  // append source of the updated module to the hot update script
  hotUpdateScriptTxt +=  updatedModule.source;
  // finish up hotUpdateScriptTxt
  hotUpdateScriptTxt +=  '},';
  // append dependencies
  hotUpdateScriptTxt +=  JSON.stringify(updatedModule.deps);
  hotUpdateScriptTxt += ']});';
  // send the update script
  res.send(hotUpdateScriptTxt);
});

// serve the app
http.listen(3001, function(){
  console.log('Serving dist on *:3001');
});