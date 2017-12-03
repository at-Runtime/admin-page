function main() { //this function will be ran when the page loads according to the bottom most statement
    let ui = new UI; //make a new UI object
    ui.loadSignInPage(); //load the sign in page
}

var UI = class {
    constructor() {
        this.mainDiv = $('#mainDiv')[0]; // in index.html between the header and the footer there is an empty div, referered to as the main div. This is where all the text will be inserted
        this.socket = io(); // this is our socket object. it initializes the connection with the database
    }

    loadSignInPage() { //this function loads the html for the sign in page and inserts it into the maindiv
        if (this.signInHTML == undefined) {
            var that = this;
            $.get("../html/login.html", function (data) { //get the login.html file, its public
                that.signInHTML = data; //store it for later use
                that.signInPage();
            });
        } else {
            this.signInPage(); //if the sign in page is already loaded the just use that data
        }
    }

    signInPage() { //handles events for sign in page
        var that = this;
        var username, password;
        this.mainDiv.innerHTML = this.signInHTML; //insert sign in html into main div
        $('#signin').click(function () { //when a user clicks sign in
            username = $('#username')[0].value.toLowerCase(); //capture username and password with password being case-sensitive
            password = $('#password')[0].value;
            that.socket.emit('signin', { //emit the signin event and send the credentials, in plaintext...? O_o
                'username': username,
                'password': password
            });
        });
        this.socket.on("authenticated", function (res) { //the server will check the credentials and emit an authenticated event, along with a bool representing a pass or fail in credential checking
            if (res === true) { //if the bool is true then the server accepted the credentials
                that.socket.emit("database", {}); //now we can request the database page and expect it to send some html back
                $('#accountBtn')[0].innerHTML = "<i class='fa d-inline fa-lg fa-user-circle-o'></i> " + username.toUpperCase(); //theres a little blue square at the top that says signin, if we have signed in we change it to the persons username in all caps
            }
            else { //if the server tells the page false, credentials did not pass, then add some text in red letting the user know the login was incorrect
                $('#uniquenameLabel')[0].innerHTML = "Uniquename <span style='color: red'>(Invalid username or password!) </span>";
                setTimeout(function(){ //after two seconds get rid of that red text because its annoying to look at
                    $('#uniquenameLabel')[0].innerHTML = "Uniquename";
                }, 2000);
            }
        });
        this.socket.on("database", function (res) { //if we get an event 'database' that means the server should be sending the html for the new database page
            that.loadPage(res); //load this page into the mainDiv using this helper function
            that.databasePage(); //this loads event handlers for the database page
        });
    }

    databasePage() {
        var dbdata;
        var activeTable = "BUILDINGS"; //by defualt when the page loads the table the user is viewing will be the BUILDINGS table
        var isUserTable = false;
        var that = this; //this lets me reference the UI class from inside callback functions
        this.socket.emit("getTable", { //ask the database for the table
            table: activeTable
        });
        this.socket.on("table", function (data) { //when the database replies with table data we need to generate the nice looking and editable table for the user to interact with
            dbdata = data;
            var grid;
            var fields = [];
            console.log(data);
            Object.keys(data[0]).forEach(function (k) { //each column has header refered to as a "field", we have an array fields that contains configuration data about each "field" this foreach statement makes a new field for every column in the database table
                var field = {};
                field.name = k; //column header will be same as column header in database
                field.type = "text"; //column will contain text values
                field.validate = "required"; //column can only contain valid data
                field.width = 12 * k.length; //the width of the column is 12 pixels * the number of characters in the column header
                if (k === "Bldg_Name") {
                    field.width = field.width + 20; //the building name entries are longer so make that column a bit bigger
                }
                else if (k === "Type") { //The type categories are long too so make that bigger as well
                    field.width = field.width + 30;
                }
                else if (k == "i") { //the i is used for lookups its not supposed to be visible or stored anywhere
                    field.visible = false;
                }
                else if (k == "Error") { //if you get an error dont let the user send insert edit and delete requests back to the server, that may crash it
                    field.editing = false;
                }
                fields.push(field); //add this field configuration to the array of fields and repeat for however many columns there are
            });
            fields.push( //this last column has the buttons for editing stuff in the table
                {
                    type: "control"
                }
            );
            grid = $('#databaseTable').jsGrid({ //jsGrid is a library im using to make the table nice and interactive http://js-grid.com. calling this initializer initalizes the table
                width: "100%",
                height: "auto",
                pageSize: 6,
                inserting: true, //let the user insert edit and make it auto sort entries too.
                editing: true,
                sorting: true,
                paging: true,
                data: dbdata, //this is where you specify to user the database data the table is generated
                fields: fields, //this is that fields array created above
                onItemInserted: function (item) { //this function runs when the user clicks the green plus sign, enters data, and hits the green plus sign again
                    var insertData = {};
                    if (!isUserTable) {
                        insertData.activeTable = activeTable;
                    }
                    else {
                        insertData.activeTable = "USERS";
                    }
                    insertData.item = item.item;
                    that.socket.emit("insertItem", insertData); //send the new inserted item back to the server
                },
                onItemDeleted: function (item) { //this function runs when the user clicks the little red trashcan to delete something
                    var deleteData = {};
                    if (!isUserTable) {
                        deleteData.activeTable = activeTable;
                    }
                    else {
                        deleteData.activeTable = "USERS";
                    }
                    deleteData.item = item.item;
                    that.socket.emit("deleteItem", deleteData); //send the item the user wishes to delete back to the server
                },
                onItemUpdated: function (item) { //this function runs when the user clicks the little pencil to edit an entry and then clicks the check mark to finish editing
                    var updateData = {};
                    if (!isUserTable) {
                        updateData.activeTable = activeTable;
                    }
                    else {
                        updateData.activeTable = "USERS";
                    }
                    updateData.item = item.item;
                    that.socket.emit("updateItem", updateData); //send the updated item that the user edited back to the server
                }
            });
        });
        $('.amenityType').click(function (e) { //when a user wants to switch tables they will click one of the categories and this function will run
            e.preventDefault(); //dont follow any link...
            activeTable = e.currentTarget.innerText.slice(0, -1).replace(/\s+/g, '_'); //the table they want to view is the string they clicked on without the newline character and with underscores instead of spaces
            $(".type.nav-link.active").removeClass('active'); //when they click remove the active class from the button that has the active class, this will make it no longer blue
            $(e.target).addClass('active'); //make the category they clicked active, this will make what they clicked turn blue
            that.socket.emit("getTable", { //request the table data from the database
                table: activeTable
            });

        });
        $('.pageType').click(function (e) { //when the user clicks either "Database Change" or "User Access Control" this function will run
            e.preventDefault();//dont follow any links
            $(".page.nav-link.active").removeClass('active'); //unhighlight the highlighted tab
            $(e.target).addClass('active'); //highlight the tab that was clicked
            if (e.currentTarget.innerText.slice(0, -1) === 'User Access Control') { //User Access Control data is in the USERS table in dynamoDb so make sure thats the table the user requests
                isUserTable = true;
                that.socket.emit("getTable", { //request the USERS table
                    table: "USERS"
                });
                $('#amenityNav').hide(); //hide the list of amenity categories, its not relevant to the Users table
            }
            else { //if they didnt click "User Access Control" then they mustve clicked "Database Change"
                $('#amenityNav').show(); //make sure the amenity picked box is visible
                isUserTable = false;
                that.socket.emit("getTable", { //request whatever table was last active or the default one
                    table: activeTable
                });
            }
        });

    }
    loadPage(page) { //this helper function just loads html into the main div when the client needs to change the UI around
        if (this.mainDiv.innerHTML != page) {
            this.mainDiv.innerHTML = page;
        }
    }
};

$(document).ready(main); //only execute the main function when everything is loaded and ready
