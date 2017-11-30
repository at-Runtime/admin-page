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
        var that = this;
        this.socket.emit("getTable", {
            table:activeTable
        });
        this.socket.on("table",function (data) {
            dbdata = data;
            //alert(dbdata);
            var grid;
            var fields = [];
            console.log(data);

            Object.keys(data[0]).forEach(function(k){
                var field = {};
                field.name = k;
                field.type = "text";
                field.validate = "required";
                field.width = 10*k.length;
                if(k === "Bldg_Name"){
                    field.width = field.width + 20;
                }
                fields.push(field);
            });
            console.log(fields);
            fields.push(
                {
                    type: "control"
                }
            );
            grid = $('#databaseTable').jsGrid({
                width: "100%",
                height: "auto",
                pageSize: 6,
                inserting: true,
                editing: true,
                sorting: true,
                paging: true,
                data: dbdata,
                fields: fields
            });
        });
        $('.amenityType').click(function (e) {
           e.preventDefault();
           activeTable = e.currentTarget.innerText;
           $(".type.nav-link.active").removeClass('active');
           $(e.target).addClass('active');
           that.socket.emit("getTable", {
                table:activeTable.slice(0,-1).replace(/\s+/g, '_')
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
