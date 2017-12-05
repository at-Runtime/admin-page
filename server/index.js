var app = require('express')(); //express handles static file serving for public files
var http = require('http').Server(app); //static file server
var io = require('socket.io')(http); //socket.io is a socket library (sockets allow for two way communication between clients and servers)
var fs = require('fs'); //fs is a filesystem module, it allows me to read files from the the host computer, its c++ equivalent is fstream
//var AWS = require("aws-sdk"); //amazons aws sdk lets me connect to dynamo-db
var process = require("process"); //This isnt necessary but it allows to check whether the server was run as root or as a normal user
var crud = require("./CRUD.js");
//AWS.config.loadFromPath(__dirname + '/config.json'); //this config file contains the access key and the secret access key

//var docClient = new AWS.DynamoDB.DocumentClient(); //the docClient object contains methods that allow you to make scan,get,insert, and delete requests to dynamodb
var partitionKeys = { //DynamoDB hashes items based on a particular field on its table, this object specifies which field is hashed for which table to make managing multiple tables easy to do in a single function
    "BUILDINGS": "Bldg_ID",
    "BUILDINGS_TEST":"aaron_test",
    "Emergency_Phones": "Location",
    "MICROWAVES": "Micro_ID",
    "OTHER": "Amen_ID",
    "OUTLETS": "Outlet_ID",
    "PARKING": "Lot_ID",
    "UPRINT": "Print_ID",
    "USERS": "username",
    "VENDING":"Vending_ID"
};
var sortKeys = {
    "BUILDINGS": "",
    "BUILDINGS_TEST":"",
    "Emergency_Phones": "",
    "MICROWAVES": "Bldg_ID",
    "OTHER": "Bldg_ID",
    "OUTLETS": "Bldg_ID",
    "PARKING": "",
    "UPRINT": "Bldg_ID",
    "USERS": "",
    "VENDING":"Bldg_ID"
};
var PORT = 3000; //the default port the server is listening on
if(process.geteuid() == 0){ //you need root permissions to run on server on port 80
    PORT = 80; //if we have these root permissions then run on 80, if not run on 3000. When running this server in the debugger it wont have root permissions, so the debugger will connect to port 3000 automaticaly because of this conditional
}
//These app.get handles handle get requests for public files
app.get('/favicon.ico', function (req, res) { //favicon.ico is the little icon in the tab on your browser
    res.sendFile('favicon.ico',{root: __dirname + "/../"});
});
app.get('/', function (req, res) { // "/" is the root directory, when someone connects to this port with no path it will default to this file
    res.sendFile('www/html/index.html', {root: __dirname + "/../"});
});
app.get('/js/main.js', function (req, res) { //the file index.html requests this file
    res.sendFile('www/js/main_organized.js', {root: __dirname + "/../"});
});
app.get('/css/change.css', function (req, res) { //the file index.html requests this file
    res.sendFile('www/css/change.css', {root: __dirname + "/../"});
});
app.get('/css/login.css', function (req, res) { //the file index.html requests this file
    res.sendFile('www/css/login.css', {root: __dirname + "/../"});
});
app.get('/html/login.html', function (req, res) { //the file index.html requests this file
    res.sendFile('www/html/login.html', {root: __dirname + "/../"});
});
app.get('/media/campus-map-summer.png', function (req, res) { //the file index.html requests this file
    res.sendFile('www/media/campus-map-summer.png', {root: __dirname + "/../"});
});

io.on('connection', function (socket) { //this is an event handler for the initial socket connection, when there is a connection, run this function
    socket.isAuthenticated = false; //this bool keeps track of whether the user is actually authenticated or not. no operation is possible unless this is set to true
    console.log('a user connected'); //print to the console
    socket.on('signin', function (req) { //when a user clicks sign on a 'signin' event is emitted containing an object with the username and password that was typed in. sent as plaintext...? O_o
            console.log("User: " + req.username + " has requested to sign in");

            socket.username = req.username;
            socket.password = req.password;

            crud.authenticate(socket); //authenticate those


    });

    socket.on('database', function (msg) { //once the client knows its authenticated it will emit 'database' and the server will give it the file "database.html" from the html folder

        crud.sendDatabasePage(socket);

        socket.on("getTable",function (data) { //once the client recieves the html for the database page it will request data from the table "BUILDINGS", and if the user clicks on any of the amenity types the client will request data for that table as well
            if(socket.isAuthenticated){ //only send data if authenticated
                crud.sendTableData(socket,data.table);
            }
            else{
                socket.emit("table",{"Error": "Refresh to sign in"});
            }
        });

        socket.on("insertItem",function(data){ //when the user clicks the green plus sign and then types in data and hits the smaller plus sign, 'insertItem' event will be emit from the socket along with a copy of the item they just tried to insert
            crud.insertItem(socket,data);
        });

        socket.on("deleteItem",function (data) { //when the user clicks the red trashcan next to an item and hits ok a 'deleteItem' event will be emit.
           crud.deleteItem(socket,data);
        });

        socket.on("updateItem",function(data){ //when a user clicks the little pencil, edits the columns and hits the green check, an insertItem event will be emit
            crud.updateItem(socket,data);
        });
    });
});

http.listen(PORT, function () { //start listening on specified port
    console.log('listening on: ' + PORT);
});