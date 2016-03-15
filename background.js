/**************************************初始化**********************************************/
var me = this;
var isDebug = false;

me.Login = {

    // 当前用户名
    name: '',

    // 登录状态session(cookie)
    _st_: null,

    // 登录地址
    url: "",

    // 登录跳转地址
    return: "action/do_extension.jsp?method=login",

    // 退出
    logout: "action/do_extension.jsp?method=logout",

    // 登录状态
    isLogin: false,

    // 线上/线下切换
    domain: 'http://admgr.pc.com.cn/tracker/'
    //domain: 'http://sp.pconline.com.cn:8081/admgr/tracker/'
    //domain: 'http://192.168.98.48:8081/admgr/tracker/'
};

// 初始化登录
$.getJSON(me.Login.domain + "action/do_extension.jsp?method=init", null, function (data) {
    me.Login.url = data['url'];

    // 证书错误(使用域名而不是ip)
    // POST https://192.168.10.213:8443/security-server/auth.do net::ERR_INSECURE_RESPONSE
});

/**************************************事件监听*********************************************/
// ...

/**************************************自定义方法*******************************************/
// 获取tracker信息
function refreshTracker(callback) {
    $.post(
        me.Login.domain + "action/do_extension.jsp",
        {
            method: 'tracker',
            st: me.Login._st_
        },
        function (data) {
            isDebug && console.log(data);
            me.Tracker = data["trackers"];
            callback();
        },
        "json"
    );
}

// 退出登录
function logout(callback) {
    // 关闭当前所有打开开发工具的窗口
    chrome.tabs.query({active: true, currentWindow: true}, function (tabs) {
        chrome.tabs.remove(tabs[0].id);
        chrome.tabs.create({active: true});
    });

    $.ajax({
        type: 'POST',
        url: me.Login.domain + me.Login.logout,
        dataType: 'json',
        data: {
            method: "logout",
            st: me.Login._st_
        },
        success: function (data, textStatus, jqXHR) {
            // ...
            changeIcon();
        },
        complete: function (data, textStatus, jqXHR) {
            if (typeof callback === "function") {
                callback(data, textStatus, jqXHR);
            }
        }
    });
}

// 改变图标
function changeIcon(fag) {

    var name = "icon_off.png";
    if (fag == "on") {
        name = "icon_on.png";
    }
    chrome.browserAction.setIcon({
        path: "source/img/" + name
    });
}

changeIcon();

/**************************************通信***********************************************/
/*如果有多个page监听onMessage事件，只有第一个调用sendResponse的page调用的sendResponse能成功*/

// Long-lived connections 长连接通信
chrome.runtime.onConnect.addListener(function (port) {

    console.log(port.name);

    port.onMessage.addListener(function (msg) {

        isDebug && console.log(msg);

        var result = {
                action: msg["action"]
            },
            needResponse = true;

        switch (msg['action']) {

            case 'track-checkLogin':
                // 未关闭(打开devtools)的窗口，如果当有用户已经退出，
                if (!me.Login.isLogin) {
                    chrome.tabs.remove(msg['tabId']);
                }
                needResponse = false;
                break;

            case 'dev-checkLogin':
                result["isLogin"] = me.Login.isLogin;
                break;

            case "dev-initDebugModal":
                result["isDebug"] = isDebug;
                break;

            case "dev-initTracker":
                result["trackers"] = me.Tracker;
                break;

            case "dev-changeDebugModal":
                isDebug = !isDebug;
                result["isDebug"] = isDebug;
                break;

            case "dev-refreshTracker":
                refreshTracker(function () {
                    // 后台请求结束时回调发送trackers
                    port.postMessage({
                        action: "dev-refreshTracker",
                        trackers: me.Tracker
                    });
                });
                needResponse = false;
                break;

            default:
                break;
        }
        needResponse && port.postMessage(result);
    });
});

// one-time requests 一次性的通信
// 可以用来调试或者用在无需反馈的通信中
chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {

    switch (msg['action']) {

        case "dev-printHARLog":
            isDebug && debugInfo(msg["harLog"], msg["onlyJS"]);
            break;

        case "dev-debugInfo":
            isDebug && console.log(msg["info"]);
            break;

        default:
            break;
    }
});

// http请求调试
function debugInfo(harLog, onlyJS) {

    console.assert(harLog.entries.length != 0, "请先刷新页面!");

    var len = onlyJS ? 0 : harLog.entries.length;

    for (var a in harLog.entries) {

        if (onlyJS) {
            var mt = harLog.entries[a].response.content.mimeType;

            if (mt == "text/javascript" || mt == "application/javascript") {
                len++;
                console.log(harLog.entries[a]);
            }
        } else {
            console.log(harLog.entries[a]);
        }
    }
}