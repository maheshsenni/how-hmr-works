/* This file is included in the page running the app */
(function() {
  // create an instance of Socket.IO for listening
  // to websocket messages
  var socket = io();

  // listen for 'file-change' message
  socket.on('file-change', function(msg) {
    console.log('File changed: ' + msg.id);
    // download the updated module to kick start
    // hot module replacement
    downloadUpdate(msg.id);
    // window.location.reload();
  });


  function downloadUpdate(id) {
    // create a new script tag and add it to the page
    // to make a JSONP request to /hot-update
    var head = document.getElementsByTagName("head")[0];
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.charset = "utf-8";
    script.src =  "/hot-update?id=" + id;
    head.appendChild(script);
  }
})();