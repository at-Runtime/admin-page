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
        this.mainDiv.innerHTML = this.signInHTML;
        $('#signin').click(function () {
            var username = $('#username')[0].value;
            var password = $('#password')[0].value;
            that.socket.emit('signin', {
                'username': username,
                'password': password
            });
        });
        this.socket.on("authenticated",function(res){
            that.socket.emit("database",{});
        });
        this.socket.on("database",function(res){
            that.loadPage(res);
            that.databasePage();
        });
    }

    databasePage(){

    }

    loadPage(page) {
        if(this.mainDiv.innerHTML != page){
            this.mainDiv.innerHTML = page;
        }
    }
};

$(document).ready(main);
