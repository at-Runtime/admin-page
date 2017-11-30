function main() {
    let ui = new UI;
    ui.loadSignInPage();
}

var UI = class {
    constructor() {
        this.mainDiv = $('#mainDiv')[0];
        this.socket = io();
    }

    loadSignInPage() {
        if (this.signInHTML == undefined) {
            var that = this;
            $.get("../html/login.html", function (data) {
                that.signInHTML = data;
                that.signInPage();
            });
        } else {
            this.signInPage();
        }
    }

    signInPage() {
        var that = this;
        var username, password;
        this.mainDiv.innerHTML = this.signInHTML;
        $('#signin').click(function () {
            username = $('#username')[0].value;
            password = $('#password')[0].value;
            that.socket.emit('signin', {
                'username': username,
                'password': password
            });
        });
        this.socket.on("authenticated", function (res) {
            if (res === true) {
                that.socket.emit("database", {});
                $('#accountBtn')[0].innerHTML = "<i class='fa d-inline fa-lg fa-user-circle-o'></i> " + username.toUpperCase();
            }
            else {
                $('#uniquenameLabel')[0].innerHTML = "Uniquename <span style='color: red'>(Invalid username or password!) </span>";
                setTimeout(function(){
                    $('#uniquenameLabel')[0].innerHTML = "Uniquename";
                }, 2000);
            }
        });
        this.socket.on("database", function (res) {
            that.loadPage(res);
            that.databasePage();
        });
    }

    databasePage() {
        var dbdata;
        var activeTable = "BUILDINGS";
        this.socket.emit("getTable", {
            table:activeTable
        });
        this.socket.on("table",function (data) {
            dbdata = data;
            //alert(dbdata);
            var grid;
            grid = $('#databaseTable').jsGrid({
                width: "100%",
                height: "400px",
                inserting: true,
                editing: true,
                sorting: true,
                paging: true,
                data: dbdata,
                fields: [
                    {name: "Blgd_ID", type: "text", validate: "required"},
                    {name: "Bldg_Name", type: "text", validate: "required"},
                    {name: "Mon_Hours", type: "text", validate: "required"},
                    {name: "Tue_Hours", type: "text", validate: "required"},
                    {name: "Wed_Hours", type: "text", validate: "required"},
                    {name: "Thu_Hours", type: "text", validate: "required"},
                    {name: "Fri_Hours", type: "text", validate: "required"},
                    {name: "Sat_Hours", type: "text", validate: "required"},
                    {name: "Sun_Hours", type: "text", validate: "required"},
                    {type: "control"}
                ]
            });
        });
    }

    loadPage(page) {
        if (this.mainDiv.innerHTML != page) {
            this.mainDiv.innerHTML = page;
        }
    }
};

$(document).ready(main);
