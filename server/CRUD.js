//Crud.js is a node.js module for performing, create, read, update, and delete operations on the database

var AWS = require("aws-sdk");
var fs = require('fs'); //fs is a filesystem module, it allows me to read files from the the host computer, its c++ equivalent is fstream

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

exports.authenticate = function(socket){ //this is a public function that authenticates the user based on credentials from the USERS table
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

exports.insertItem = function(socket,data){ //this is a public function that inserts items into a specific table of the database, data must be an object containing an activeTable key and an item key with the object to be inserted as the value
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
                exports.sendTableData(socket,data.activeTable);
            }
        });
    }
}

exports.deleteItem = function(socket,data){ //this is a public function for deleting objects in the database, data must be an object containing an activeTable key and an item key with the object to be inserted as the value
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
                exports.sendTableData(socket,data.activeTable);
            }
        });
    }
}

exports.updateItem = function(socket,data){ //this is a public function for updating an item in the database, data must be an object containing an activeTable key and an item key with the object to be inserted as the value
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
                        exports.sendTableData(socket,data.activeTable);
                    }
                });
            }
        });
    }
}

exports.sendDatabasePage = function(socket){ //this is a public function for sending the file database.html to the specified socket
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

exports.sendTableData = function(socket,table){ //this is a public function that gets data from a specific table in the database and send its to the specified socket.
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