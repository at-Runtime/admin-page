var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');

var PORT = 3000;

app.get('/favicon.ico', function (req, res) {
    res.sendFile('favicon.ico');
});

app.get('/', function (req, res) {
    res.sendFile('www/html/index.html', {root: __dirname + "/../"});
});
app.get('/js/main.js', function (req, res) {
    res.sendFile('www/js/main.js', {root: __dirname + "/../"});
});
app.get('/css/change.css', function (req, res) {
    res.sendFile('www/css/change.css', {root: __dirname + "/../"});
});
app.get('/css/login.css', function (req, res) {
    res.sendFile('www/css/login.css', {root: __dirname + "/../"});
});
app.get('/html/login.html', function (req, res) {
    res.sendFile('www/html/login.html', {root: __dirname + "/../"});
});
app.get('/media/campus-map-summer.png', function (req, res) {
    res.sendFile('www/media/campus-map-summer.png', {root: __dirname + "/../"});
});

io.on('connection', function (socket) {
    var isAuthenticated = false;
    console.log('a user connected');
    socket.on('signin', function (req) {
        console.log("User: " + req.username + " has requested to sign in");
        if(req.username === "aaron" && req.password === "0000") {
            io.emit("authenticated", true);
            isAuthenticated = true;
        }
        else{
            io.emit("authenticated", false);
        }
    });

    socket.on('database', function (msg) {
        if (isAuthenticated) {
            fs.readFile('../www/html/database.html', "utf8", function (err, data) {
                io.emit('database', data);
            });
        }
        else{
            io.emit('database',"ERROR: PLEASE SIGN IN");
        }
    });
});

http.listen(PORT, function () {
    console.log('listening on: ' + PORT);
});
