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
            username = $('#username')[0].value.toLowerCase();
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
        var activeTable = "BUILDINGS_TEST";
        var isUserTable = false;
        var that = this;
        this.socket.emit("getTable", {
            table:activeTable
        });
        this.socket.on("table",function (data) {
            dbdata = data;
            var grid;
            var fields = [];
            console.log(data);
            Object.keys(data[0]).forEach(function(k){
                var field = {};
                field.name = k;
                field.type = "text";
                field.validate = "required";
                field.width = 12*k.length;
                if(k === "Bldg_Name"){
                    field.width = field.width + 20;
                }
                else if(k === "Type"){
                    field.width = field.width + 30;
                }
                else if(k == "i"){
                    field.visible = false;
                }
                fields.push(field);
            });
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
                fields: fields,
                onItemInserted: function (item) {
                    var insertData = {};
                    if(!isUserTable){
                        insertData.activeTable = activeTable;
                    }
                    else{
                        insertData.activeTable = "USERS";
                    }
                    insertData.item = item.item;
                    that.socket.emit("insertItem", insertData);
                },
                onItemDeleted: function(item){
                    var deleteData = {};
                    if(!isUserTable){
                        deleteData.activeTable = activeTable;
                    }
                    else{
                        deleteData.activeTable = "USERS";
                    }
                    deleteData.item = item.item;
                    that.socket.emit("deleteItem", deleteData);
                },
                onItemUpdated: function(item){
                    var updateData = {};
                    if(!isUserTable){
                        updateData.activeTable = activeTable;
                    }
                    else{
                        updateData.activeTable = "USERS";
                    }
                    updateData.item = item.item;
                    that.socket.emit("updateItem",updateData);
                }
            });
        });
        $('.amenityType').click(function (e) {
           e.preventDefault();
           activeTable = e.currentTarget.innerText.slice(0,-1).replace(/\s+/g, '_');
           $(".type.nav-link.active").removeClass('active');
           $(e.target).addClass('active');
           that.socket.emit("getTable", {
                table:activeTable
            });

        });
        $('.pageType').click(function (e) {
             e.preventDefault();
             $(".page.nav-link.active").removeClass('active');
             $(e.target).addClass('active');
             if(e.currentTarget.innerText.slice(0,-1) === 'User Access Control'){
                 isUserTable = true;
                 that.socket.emit("getTable", {
                     table: "USERS"
                 });
                 $('#amenityNav').hide();
             }
             else{
                 $('#amenityNav').show();
                 isUserTable = false;
                 that.socket.emit("getTable", {
                     table: activeTable
                 });
             }
        });
        $('#apply').click(function (e) {
            e.preventDefault();
            var tableData = {
                data: $("#databaseTable").data("JSGrid").data
            };
            if(!isUserTable){
                tableData.activeTable = activeTable;
            }
            else{
                tableData.activeTable = "USERS";
            }
            console.log(tableData);
            that.socket.emit("applyUpdate",tableData);
        });
        $('#cancel').click(function (e) {
            if(!isUserTable){
                that.socket.emit("getTable", {
                    table: activeTable
                });
            }
            else{
                that.socket.emit("getTable", {
                    table: "USERS"
                });
            }
        });
    }

    loadPage(page) {
        if (this.mainDiv.innerHTML != page) {
            this.mainDiv.innerHTML = page;
        }
    }
};

$(document).ready(main);
