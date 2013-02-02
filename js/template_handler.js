/**
 * Created with IntelliJ IDEA.
 * User: jan
 * Date: 02.02.13
 * To change this template use File | Settings | File Templates.
 */
var Templates = function () {
    this.templates = {};
};
var T = new Templates();

$.extend(Templates.prototype, {
    getTemplate: function (name) {
        if (T.templates === undefined || T.templates[name] === undefined) {
            $.ajax({
                url: 'tpl/' + name + '.hbs',
                success: function (data) {
                    if (T.templates === undefined) {
                        T.templates = {};
                    }
                    T.templates[name] = Handlebars.compile(data);
                },
                async: false
            });
        }
        return T.templates[name];
    }
});