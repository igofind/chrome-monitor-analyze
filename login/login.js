$(function () {

    var bg = chrome.extension.getBackgroundPage(),
        Login = bg['Login'];

    // 每次点击图标检查版本
    bg.initBg();

    if (Login.isLogin) {

        showLoginPanel(false);
        showUserInfo(Login['user']);

    } else {

        if ("" === Login['url']) {
            loading();
        } else {
            $("#login-form").attr("action", Login['url']);
            $("input[name=return]").val(Login['domain'] + Login['return']);
        }
    }

    if (bg.hasNewVersion()) {
        var fa = $('<i class="fa fa-cloud-download"></i>');

        chrome.browserAction.setBadgeText({
            text: '1'
        });

        chrome.browserAction.setBadgeBackgroundColor({color: "#39cccc"});

        fa.on("click", function () {
            chrome.tabs.create({
                url: Login.domain,
                active: true
            }, function (tab) {
                // ...
            });
        });

        $("p.msg").html('下载最新版&nbsp;').append(fa);
    }

    $('#login-form').bootstrapValidator({
        fields: {
            username: {
                validators: {
                    notEmpty: {
                        message: ' '
                    }
                }
            },
            password: {
                validators: {
                    notEmpty: {
                        message: ' '
                    }
                }
            }
        }
    });

    // 不加这句，原生的submit会被触发!
    $("#login-form").ajaxForm();

    // 登录
    $("#submit-btn").on("click", function () {
        var validator = $("#login-form").data('bootstrapValidator').validate();
        if (!validator.isValid()) {
            return false;
        }

        $("#login-form").ajaxSubmit({
            dataType: 'json',
            beforeSubmit: function () {
                loading();
            },
            success: function (responseText, statusText, xhr, form) {
                var data = responseText;
                switch (data['result']) {
                    case "success" :
                        // 重置password
                        $("#password").val("");

                        // 隐藏登录界面
                        showLoginPanel(false);

                        // 设置背景页中Login
                        var bgPage = chrome.extension.getBackgroundPage();
                        bgPage.Login["_st_"] = data["st"];
                        bgPage.Login["user"] = data["user"];
                        bgPage.Login["isLogin"] = true;
                        bgPage.Tracker = data["trackers"];
                        // 切换icon
                        bgPage.changeIcon("on");

                        showUserInfo(data["user"]);
                        break;
                    case "wrong" :
                        showError("用户名或密码错误！");
                        break;

                    case "noRight" :
                        showError("没有权限！");
                        break;
                    default :
                        break;
                }

                loading("hide");
                return false;
            },
            error: function (response) {

                loading("hide");
                // showError(response.responseText);
                showError("用户名或密码错误！", response.responseText);
                return false;
            }
        });
    });

    // 退出
    $("#logout-link").on("click", function () {

        loading();

        var bgPage = chrome.extension.getBackgroundPage();
        bgPage.Login["_st_"] = "";
        bgPage.Login["user"] = null;
        bgPage.Login["isLogin"] = false;

        bgPage.logout(function () {
            loading(false);
            // hide user info
            showUserInfo();
            // show login form
            showLoginPanel(true);
        });
    });

    function loading(display) {
        if (display === "hide") {
            $("#overlay-dialog").modal("hide");
        } else {
            $("#overlay-dialog").modal();
        }
    }

    function showUserInfo(user) {
        if (user != null) {
            // hide
            showLoginPanel(false);

            $("h3.username").html(user['name']);
            $("#user-info").show();
        } else {
            window.location.reload();
        }
    }

    function showLoginPanel(yes) {
        if (yes) {
            $("#login-div").show();
        } else {
            $("#login-div").hide();
        }
    }

    function showError(msg, realError) {
        // 给用户看
        $("#error-span").html(msg);
        // 真实错误
        $("#error-real").html(realError);

        $("#error-div").show();
    }
});