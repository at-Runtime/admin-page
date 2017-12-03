var app = require('express')(); //express handles static file serving for public files
var http = require('http').Server(app); //static file server
var io = require('socket.io')(http); //socket.io is a socket library (sockets allow for two way communication between clients and servers)
var fs = require('fs'); //fs is a filesystem module, it allows me to read files from the the host computer, its c++ equivalent is fstream
var AWS = require("aws-sdk"); //amazons aws sdk lets me connect to dynamo-db
var process = require("process"); //This isnt necessary but it allows to check whether the server was run as root or as a normal user

AWS.config.loadFromPath(__dirname + '/config.json'); //this config file contains the access key and the secret access key

var docClient = new AWS.DynamoDB.DocumentClient(); //the docClient object contains methods that allow you to make scan,get,insert, and delete requests to dynamodb
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

            authenticate(socket); //authenticate those


    });

    socket.on('database', function (msg) { //once the client knows its authenticated it will emit 'database' and the server will give it the file "database.html" from the html folder

        sendDatabasePage(socket);

        socket.on("getTable",function (data) { //once the client recieves the html for the database page it will request data from the table "BUILDINGS", and if the user clicks on any of the amenity types the client will request data for that table as well
            if(socket.isAuthenticated){ //only send data if authenticated
                sendTableData(socket,data.table);
            }
            else{
                socket.emit("table",{"Error": "Refresh to sign in"});
            }
        });

        socket.on("insertItem",function(data){ //when the user clicks the green plus sign and then types in data and hits the smaller plus sign, 'insertItem' event will be emit from the socket along with a copy of the item they just tried to insert
            insertItem(socket,data);
        });

        socket.on("deleteItem",function (data) { //when the user clicks the red trashcan next to an item and hits ok a 'deleteItem' event will be emit.
           deleteItem(socket,data);
        });

        socket.on("updateItem",function(data){ //when a user clicks the little pencil, edits the columns and hits the green check, an insertItem event will be emit
            updateItem(socket,data);
        });
    });
});

http.listen(PORT, function () { //start listening on specified port
    console.log('listening on: ' + PORT);
});

var authenticate = function(socket){
    var params = { //this object contains the key i am using to lookup a persons password in the database
        TableName: "USERS",
        Key: {
            "username": socket.username
        }
    };
    docClient.get(params, function (err, data) { //use docClient to get the user information from the database
        if (err) {
            console.log("Error getting user credentials: " + err);
        }
        else {
            data.Item = data.Item || {username: "", password: ""}; //if a user doesnt type anything into username then the docclient response will be empty so this sets the values to empty strings if the response is empty
            if (socket.password === data.Item.password && data.Item.password != undefined && data.Item.password != "") { //make sure the password typed in matches the password in the database and make sure its not undefined or empty
                console.log("User: " + socket.username + " is authenticated");
                socket.emit("authenticated", true); //if they match then the user is authenticated!
                socket.isAuthenticated = true; //set the bool to true to allow the user to perform operations once the page loads
                socket.access_level = data.Item.access_level; //also store the access level because some operations are restricted for some users
            }
            else {
                console.log("User: " + socket.username + " entered invalid credentials"); //if the credentials dont match then let the client know it didnt match
                socket.emit("authenticated", false);
            }
        }
    });
}

var insertItem = function(socket,data){
    if(socket.isAuthenticated){
        var params = { //we want to take that item and insert it into the database, if we did data validation it should be checked here
            TableName: data.activeTable,
            Item: data.item
        };
        docClient.put(params, function(err, res) { //put method can insert or update an item
            if (err) {
                console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("Added item:", JSON.stringify(res, null, 2));
                sendTableData(socket,data.activeTable);
            }
        });
    }
}

var deleteItem = function(socket,data){
    if(socket.isAuthenticated){
        var partitionKey = {};
        partitionKey[partitionKeys[data.activeTable]] = data.item[partitionKeys[data.activeTable]]; //you can only delete things if you query based on the partitionkey, this line makes sure the correct one is selected
        if(sortKeys[data.activeTable] != ""){
            partitionKey[sortKeys[data.activeTable]] = data.item[sortKeys[data.activeTable]];
        }
        var params = {
            TableName: data.activeTable,
            Key: partitionKey
        };
        docClient.delete(params, function(err, res) { //delete request deletes an item based on its partition key
            if (err) {
                console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("DeleteItem succeeded:", JSON.stringify(res, null, 2));
                sendTableData(socket,data.activeTable);
            }
        });
    }
}

var updateItem = function(socket,data){
    if(socket.isAuthenticated){
        for(var i=0;i<socket.currTable.length;i++){ //in the reference table find the entry the user is trying to edit based on the i value
            if(socket.currTable[i].i == data.item.i){
                break;
            }
        }
        var partitionKey = {};
        partitionKey[partitionKeys[data.activeTable]] = socket.currTable[i][partitionKeys[data.activeTable]]; //once found use the original entry to generate the partition key, just in case the partition key is what the user decided to change
        if(sortKeys[data.activeTable] != ""){
            partitionKey[sortKeys[data.activeTable]] = socket.currTable[i][sortKeys[data.activeTable]];
        }
        var params = {
            TableName: data.activeTable,
            Key: partitionKey
        };
        docClient.delete(params, function(err, res) { //delete the entry the user tried to change
            if (err) {
                console.error("Unable to delete item. Error JSON:", JSON.stringify(err, null, 2));
            } else {
                console.log("DeleteItem succeeded");
                var params2 = {
                    TableName: data.activeTable,
                    Item: data.item
                };
                docClient.put(params2, function(err, res2) { //when its been deleted, insert the new updated item
                    if (err) {
                        console.error("Unable to add item. Error JSON:", JSON.stringify(err, null, 2));
                    } else {
                        console.log("Added item:", JSON.stringify(res2, null, 2));
                        sendTableData(socket,data.activeTable);
                    }
                });
            }
        });
    }
}

var sendDatabasePage = function(socket){
    if (socket.isAuthenticated) { //it will only send the file if its authenticated
        fs.readFile(__dirname + '/../www/html/database.html', "utf8", function (err, data) { //read the file in and send it
            if(err){
                console.log("Error Reading file: " + err);
            }
            else{
                socket.emit('database', data);
            }
        });
    }
    else{
        socket.emit('database',"<h1>ERROR: PLEASE SIGN IN</h1>");
    }
}

var sendTableData = function(socket,table){
    docClient.scan({ //scan returns all the items in a particular table
        TableName: table
    }, function (err, res) {
        if (err) {
            console.error("Unable to read item. Error JSON:", JSON.stringify(err, null, 2));
        } else { //if there are no errors
            res.Items.forEach(function (t,i) { //add the index value i to the items list, this makes it easier to track changes to the data once the user edits something
                t.i = i;
            });
            socket.currTable = res.Items; //also store the data from the current table to be used as a reference to the original when the user starts editing
            if(table != "USERS"){ //if its not the USER table then just send it because everyone with a login can edit this data
                socket.emit("table", res.Items);
            }
            else{ //if it is the USER table then we need to check and make sure the person has owner access level because admins arent allowed to view or change anyones password
                if(socket.access_level != "owner"){
                    socket.emit("table", [{"Error": "You do not have permission to perform this function"}]);
                }
                else{
                    socket.emit("table", res.Items);
                }
            }
        }
    })
}