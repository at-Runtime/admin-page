var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');
var AWS = require("aws-sdk");
var process = require("process");

AWS.config.loadFromPath(__dirname + '/config.json');

var docClient = new AWS.DynamoDB.DocumentClient();
var partitionKeys = {
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
var PORT = 3000;
if(process.geteuid() == 0){
    PORT = 80;
}
app.get('/favicon.ico', function (req, res) {
    res.sendFile('favicon.ico',{root: __dirname + "/../"});
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
    socket.isAuthenticated = false;
    console.log('a user connected');
    socket.on('signin', function (req) {
        console.log("User: " + req.username + " has requested to sign in");
        var params = {
            TableName: "USERS",
            Key:{
                "username": req.username
            }
        };
        docClient.get(params, function(err, data) {
            if(err){
                console.log("Error getting user credentials: " + err);
            }
            else{
                if(req.password === data.Item.password) {
                    console.log("User: " + req.username + " is authenticated");
                    socket.emit("authenticated", true);
                    socket.isAuthenticated = true;
                    socket.username = req.username;
                    socket.access_level = data.Item.access_level;
                }
                else{
                    console.log("User: " + req.username + " entered invalid credentials");
                    socket.emit("authenticated", false);
                }
            }
        });


    });

    socket.on('database', function (msg) {
        if (socket.isAuthenticated) {
            fs.readFile(__dirname + '/../www/html/database.html', "utf8", function (err, data) {
                if(err){
                    console.log("Error Reading file: " + err);
                }
                else{
                    socket.emit('database', data);
                }
            });
        }
        else{
            socket.emit('database',"ERROR: PLEASE SIGN IN");
        }
        socket.on("getTable",function (data) {
            if(socket.isAuthenticated){
                docClient.scan({
                    TableName: data.table
                }, function (err, res) {
                    if (err) {
                        console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        res.Items.forEach(function (t,i) {
                           t.i = i;
                        });
                        socket.currTable = res.Items;
                        if(data.table != "USERS"){
                            socket.emit("table", res.Items);
                        }
                        else{
                            if(socket.access_level != "owner"){
                                socket.emit("table", [{"Error": "You do not have permission to perform this function"}]);
                            }
                            else{
                                socket.emit("table", res.Items);
                            }
                        }
                    }
                });
            }
        });
        socket.on("insertItem",function(data){
            if(socket.isAuthenticated){
                var params = {
                    TableName: data.activeTable,
                    Item: data.item
                };
                docClient.put(params, function(err, data) {
                    if (err) {
                        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("Added item:", JSON.stringify(data, null, 2));
                    }
                });
            }
        });
        socket.on("deleteItem",function (data) {
           if(socket.isAuthenticated){
               var partitionKey = {};
               partitionKey[partitionKeys[data.activeTable]] = data.item[partitionKeys[data.activeTable]];
               var params = {
                   TableName: data.activeTable,
                   Key: partitionKey
               };
               docClient.delete(params, function(err, data) {
                   if (err) {
                       console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
                   } else {
                       console.log("DeleteItem succeeded:", JSON.stringify(data, null, 2));
                   }
               });
           }
        });
        socket.on("updateItem",function(data){
            if(socket.isAuthenticated){
                for(var i=0;i<socket.currTable.length;i++){
                    if(socket.currTable[i].i == data.item.i){
                        break;
                    }
                }
                var partitionKey = {};
                partitionKey[partitionKeys[data.activeTable]] = socket.currTable[i][partitionKeys[data.activeTable]];
                var params = {
                    TableName: data.activeTable,
                    Key: partitionKey
                };
                docClient.delete(params, function(err, res) {
                    if (err) {
                        console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("DeleteItem succeeded");
                        var params2 = {
                            TableName: data.activeTable,
                            Item: data.item
                        };
                        docClient.put(params2, function(err, data) {
                            if (err) {
                                console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                            } else {
                                console.log("Added item:", JSON.stringify(data, null, 2));
                            }
                        });
                    }
                });
            }
        });
        socket.on("applyUpdate",function(data){
            if(socket.isAuthenticated){
                socket.currTable.forEach(function (t, n) {
                    for(var i=0;i<data.data.length;i++){
                        if(t.i == data.data[i].i){
                            var isDifferent = false;
                            Object.keys(data.data[i]).forEach(function (k) {
                               if(data.data[i][k] !== t[k]){
                                   isDifferent = true;
                               }
                            });
                            if(isDifferent){
                                //delete old entry and insert new one
                                console.log("Deleting: " + JSON.stringify(t));
                                console.log("Inserting: " + JSON.stringify(data.data[i]));
                                console.log("From table: " + data.activeTable);
                            }
                            break;
                        }
                    }
                });
            }
        });
    });
});

function orderKeys(obj, expected) {

    var keys = Object.keys(obj).sort(function keyOrder(k1, k2) {
        if (k1 < k2) return -1;
        else if (k1 > k2) return +1;
        else return 0;
    });

    var i, after = {};
    for (i = 0; i < keys.length; i++) {
        after[keys[i]] = obj[keys[i]];
        delete obj[keys[i]];
    }

    for (i = 0; i < keys.length; i++) {
        obj[keys[i]] = after[keys[i]];
    }
    return obj;
}

http.listen(PORT, function () {
    console.log('listening on: ' + PORT);
});
