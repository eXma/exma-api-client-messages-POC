/**
 * Created with IntelliJ IDEA.
 * User: jan
 * Date: 02.02.13
 * To change this template use File | Settings | File Templates.
 */
var API_PATH = "http://localhost:5000";

window.Folder = Backbone.Model.extend({

});

window.FolderCollection = Backbone.Collection.extend({
    model: Folder,
    url: API_PATH + "/messages/folder"
});

window.FolderNavView = Backbone.View.extend({

    template: T.getTemplate("folder_link"),
    tagName: "ul",
    id: "folder_nav",
    active_id: undefined,

    initialize: function () {
        this.collection.bind("reset", this.reRender, this);
    },

    updateTitle: function (e) {
        $(this.$el).find("h1").html(this.model.get("title"));
    },

    reRender: function () {
        this.$el.find("li.folder").remove();
        this.render();
    },

    appendDir: function (data) {
        this.$el.append(this.template(data));
    },

    render: function (eventName) {
        var data;
        this.appendDir({name: "All", id: "", active: this.active_id === undefined});
        _.each(this.collection.models, function (folder) {
            data = folder.toJSON();
            if (folder.get("id") === this.active_id) {
                data.active = true;
            }
            this.appendDir(data);
        }, this);
        return this;
    }
});


window.Message = Backbone.Model.extend({
    urlRoot: API_PATH + "/messages/single/"
});

window.MessageCollection = Backbone.Collection.extend({
    model: Message,
    defaults: {
        folder: undefined
    },
    url: function () {
        var base = API_PATH + "/messages";
        if (this.folder === undefined) {
            return base;
        }
        return base + "/folder/" + this.folder.get("id");
    }

});


window.MessageView = Backbone.View.extend({
    template: T.getTemplate("message_collapse"),
    bodyTemplate: undefined,

    events: {
        "show .collapse": "refreshModel"
    },

    initialize: function () {
        this.model.bind("change", this.renderBody, this);
    },
    renderBody: function () {
        this.$el.find(".accordion-inner").html("<pre></pre>");
        this.$el.find("pre").html(this.model.get("body").text);
    },
    refreshModel: function () {
        this.model.fetch();
    },
    render: function () {
        var data = this.model.toJSON();
        data.from_now = moment.unix(this.model.get("date")).fromNow();
        this.$el.html(this.template(data));
        return this;
    }
});

window.MessageListView = Backbone.View.extend({

    tagName: "div",

    initialize: function () {
        this.accordeon = this.$el.find("#messageAccordion");
        this.heading = this.$el.find("h1");
        this.collection.bind("reset", this.reRender, this);
    },

    reRender: function () {
        this.accordeon.empty();
        this.render();
    },

    render: function () {
        var heading = "All Messages";
        if (this.collection.folder !== undefined) {
            heading = "Messages in " + this.collection.folder.get("name");
        }
        this.heading.html(heading);
        _.each(this.collection.models, function (message) {
            var view = new MessageView({model: message});
            this.accordeon.append(view.render().el);
        }, this);
        return this;
    }

});


window.Session = Backbone.Model.extend({
    defaults: {
        active: false,
        user: "None"
    },
    login: function (username, password) {
        var that = this;
        $.ajax({
            url: API_PATH + '/login',
            type: "POST",
            xhrFields: {
                withCredentials: true
            },
            async: true,
            data: {login: username, password: password},
            success: function (data) {
                that.set("user", username);
                that.set("active", true);
            }
        });
    },
    logout: function () {
        var that = this;
        $.ajax({
            url: API_PATH + '/logout',
            type: "GET",
            success: function (data) {
                that.set("user", "None");
                that.set("active", false);
            },
            xhrFields: {
                withCredentials: true
            },
            async: true
        });
    },
    check: function () {
        var that = this;
        $.ajax({
            url: API_PATH + '/login',
            type: "GET",
            success: function (data) {
                that.set("user", data.login);
                that.set("active", true);
            },
            xhrFields: {
                withCredentials: true
            },
            async: true
        });
    }

});

window.LoginView = Backbone.View.extend({
    template: T.getTemplate("login"),

    events: {
        "submit #login": "doLogin",
        "click #logout_btn": "doLogout"
    },

    initialize: function () {
        this.model.on("change:user", this.setUser, this);
        this.model.on("change:active", this.checkSession, this);
    },
    setUser: function () {
        this.$el.find("#Username").html(this.model.get("user"));
    },
    checkSession: function () {
        if (this.model.get("active")) {
            this.screen.modal("hide");
            this.trigger("activeSession");
        } else {
            this.render();
        }
    },
    render: function () {
        this.screen = $(this.template());
        var that = this;
        this.screen.on("hidden", function () {
            that.screen.remove();
            that.screen = undefined;
        });
        this.$el.append(this.screen);
        this.screen.modal("show");
        return this;
    },
    doLogin: function (e) {
        e.preventDefault();
        var username = this.screen.find("form input#inputLogin").val();
        var passwd = this.screen.find("form input#inputPassword").val();
        this.model.login(username, passwd);
    },
    doLogout: function (e) {
        e.preventDefault();
        this.model.logout();
    },
    start: function () {
        this.render();
        var that = this;
        this.screen.on("shown", function() {
            that.model.check();
        });
    }
});

var AppRouter = Backbone.Router.extend({

    formerActive: false,
    routes: {
        "show/*folderId": "showFolder",
        "*all": "defaultRoute"
    },

    initialize: function () {
        this.folderCollection = new FolderCollection();
        this.messageCollection = new MessageCollection();
        this.folderView = new FolderNavView({el: $("ul#folder_nav"), collection: this.folderCollection});
        this.messageView = new MessageListView({el: $("#message_list"), collection: this.messageCollection});
        this.sessionModel = new Session();

        this.loginView = new LoginView({model: this.sessionModel, el: $("body")});
        this.loginView.on("activeSession", this.activate, this);
    },

    defaultRoute: function () {
        this.showFolder(undefined);
    },

    showFolder: function (folderId) {
        this.folderView.active_id = folderId;
        this.messageCollection.folder = this.folderCollection.get(folderId);
        this.reload();
    },

    reload: function () {
        this.folderCollection.fetch();
        this.messageCollection.fetch();
    },

    activate: function () {
        if (this.formerActive) {
            this.reload();
        } else {
            Backbone.history.start();
        }
    },

    start: function () {
        this.loginView.start();
    }
});