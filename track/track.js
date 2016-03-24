/**************************************工具栏**********************************************/
var port = chrome.runtime.connect({name: "track-connect-background"});

var
    // 标识
    TRACKER = 1,
    TRACKER_LINK = 2,
    HEAT_MAP = 3,
    HEAT_MAP_LINK = 4,
    // html元素中存储的数据的名称
    DATA_NAME = "resultCnt",

    // 标识库
    trackers = null,

    // 结果
    result = {},

    // 各个结果的列表区域
    trackerDiv = $("#result-tracker"),
    trackerListDiv = trackerDiv.find(".list").first(),
    trackerCntSpan = trackerDiv.find(".count").first(),

    trackerLinkDiv = $("#result-tracker-link"),
    trackerLinkListDiv = trackerLinkDiv.find(".list").first(),
    trackerLinkCntSpan = trackerLinkDiv.find(".count").first(),

    heatMapDiv = $("#result-heatMap"),
    heatMapListDiv = heatMapDiv.find(".list").first(),
    heatMapCntSpan = heatMapDiv.find(".count").first(),

    heatMapLinkDiv = $("#result-heatMap-link"),
    heatMapLinkListDiv = heatMapLinkDiv.find(".list").first(),
    heatMapLinkCntSpan = heatMapLinkDiv.find(".count").first();

// 初始化
result[TRACKER] = {};
result[TRACKER_LINK] = {};
result[HEAT_MAP] = {};
result[HEAT_MAP_LINK] = {};

// 解析
$("button#analyze").on("click", function () {

    printDevFn("click:解析");

    // 日志相关
    port.postMessage({action: "track-sendLog", tabId: chrome.devtools.inspectedWindow.tabId});

    // 开始前先清空所有遗留结果
    clearAllResult();

    chrome.devtools.inspectedWindow.getResources(function (arrs) {

        for (var i = 0; i < arrs.length; i++) {

            var arr = arrs[i],
                url = arr['url'],
                type = arr['type'];

            switch (type) {

                case "document":
                case "script":
                    arr.getContent(function (content) {
                        doMain(content, false);
                    });
                    break;

                // css/img...
                default:
                    break;
            }
        }

        chrome.devtools.inspectedWindow.reload();
    });
});

// 清空
$("button#clear").on("click", function () {
    clearAllResult();
});

// 刷新库
$("button#refreshTracker").on("click", function () {
    port.postMessage({action: 'track-refreshTracker'});
});

// 刷新页面
$("button#refreshPage").on("click", function () {

    // 清空上次请求的地址
    clearTrackerLink();
    cleatHeatMapLink();

    printDevFn("click:refreshPage");
    chrome.devtools.inspectedWindow.reload();
});

// 开启/关闭调试
$("button#changeDebugModal").on("click", function () {
    printDevFn("click:开启/关闭调试");
    port.postMessage({action: 'track-changeDebugModal'});
});

// #result-total, #result-link-total, #result-heatMap-total 折叠和展开
$(".total").on("click", function () {
    $(this).parent().find(".list").first().slideToggle("normal");
});

/****************************************主逻辑*********************************************/
chrome.devtools.network.onNavigated.addListener(function () {

    // 分析和刷新窗口操作验证登录状态
    port.postMessage({action: "track-checkLogin", tabId: chrome.devtools.inspectedWindow.tabId});
});

/*为每个http请求添加监听 热力图 & flash监听*/
chrome.devtools.network.onRequestFinished.addListener(function (request) {

    if (trackers == null) {
        // initTracker初始化trackers
        port.postMessage({action: "track-initTracker"});
    }
    // debug
    var
        url = request.request.url,
        onlyJS = $("#onlyJS").prop("checked"),
        mt = request.response.content.mimeType;

    if (onlyJS && (mt == "text/javascript" || mt == "application/javascript")) {

        printDevFn(url);
    } else if(!onlyJS){

        printDevFn(url);
    }

    doMain(url, true);
});

// initDebugModal初始化调试按钮
port.postMessage({action: "track-initDebugModal"});

// initTracker初始化trackers
port.postMessage({action: "track-initTracker"});

// 接收反馈信息
port.onMessage.addListener(function (result) {

    switch (result["action"]) {

        case "track-initTracker":
        case "track-refreshTracker":
            trackers = result['trackers'];
            break;

        case "track-initDebugModal":
        case "track-changeDebugModal":
            changeDebugModal(result["isDebug"]);
            break;

        default:
            break;
    }
});

// 分析js文件
function doTrack(content, target, mark, tracker, isLink) {

    if (content.indexOf(mark) != -1 && !result[target][tracker["trackerId"]]) {

        writeToList(content, target, mark, tracker, isLink);
    }
}

// 分析发送的http请求
function doLink(url, linkTarget, listTarget, mark, tracker) {

    if (url.indexOf(mark) != -1 && !result[linkTarget][url]) {

        writeToList(url, linkTarget, mark, tracker, true);

        // 注：http请求检测可以补充遗漏的Tracker
        if (!result[listTarget][tracker["trackerId"]] && !result[listTarget][tracker["trackerId"]]) {

            writeToList(url, listTarget, mark, tracker, false);
        }
    }
}

// 分析主入口
function doMain(content, isLink) {

    var length = trackers.length;

    for (var i = 0; i < length; i++) {
        var
            marks = "",
            tracker = trackers[i],
            heatMaps = tracker["heatMap"],
            labels = tracker["label"];

        if (labels != null && labels.trim() != "") {

            marks = labels.split(";");

            for (var j = 0; j < marks.length; j++) {

                if (marks[j] === null || marks[j] === "" || marks[j].trim() === "") {
                    continue;
                }
                // 文件
                if (!isLink) {
                    doTrack(content, TRACKER, marks[j], tracker);

                } else { // link 链接
                    doLink(content, TRACKER_LINK, TRACKER, marks[j], tracker);
                }
            }
        }

        if (heatMaps != null && heatMaps.trim() != "") {
            marks = heatMaps.split(";");

            for (var k = 0; k < marks.length; k++) {

                if (marks[k] === null || marks[k] === "" || marks[k].trim() === "") {
                    continue;
                }
                // 文件
                if (!isLink) {
                    doTrack(content, HEAT_MAP, marks[k], tracker);

                } else { // link 链接
                    doLink(content, HEAT_MAP_LINK, HEAT_MAP, marks[k], tracker);
                }
            }
        }

    }
}

// 清理所有的监测结果
function clearAllResult() {
    clearTracker();
    clearTrackerLink();
    clearHeatMap();
    cleatHeatMapLink();
}

function clearTracker() {
    // Tracker
    result[TRACKER] = {};

    trackerListDiv.html("");
    trackerCntSpan.data(DATA_NAME, 0).html(0);
}

function clearTrackerLink() {
    // Tracker Link
    result[TRACKER_LINK] = {};

    trackerLinkListDiv.html("");
    trackerLinkCntSpan.data(DATA_NAME, 0).html(0);
}

function clearHeatMap() {
    // HeatMap
    result[HEAT_MAP] = {};

    heatMapListDiv.html("");
    heatMapCntSpan.data(DATA_NAME, 0).html(0);
}

function cleatHeatMapLink() {
    // HeatMap Link
    result[HEAT_MAP_LINK] = {};

    heatMapLinkListDiv.html("");
    heatMapLinkCntSpan.data(DATA_NAME, 0).html(0);
}

// 输出统计结果
function countResult(target) {
    var count, cntSpan;

    // 计数(用于单双行的着色)
    result[target]["lines"] == null ? result[target]["lines"] = 1 : result[target]["lines"]++;

    switch (target) {
        case TRACKER:
            cntSpan = trackerCntSpan;
            break;
        case TRACKER_LINK:
            cntSpan = trackerLinkCntSpan;
            break;
        case HEAT_MAP:
            cntSpan = heatMapCntSpan;
            break;
        case HEAT_MAP_LINK:
            cntSpan = heatMapLinkCntSpan;
            break;
        default:
            break;
    }
    count = cntSpan.data(DATA_NAME);
    count = count ? count + 1 : 1;

    cntSpan.data(DATA_NAME, count);
    cntSpan.html(count);
    return count;
}

// 输出到页面监测结果区域中
function writeToList(content, target, label, tracker, isLink) {
    var
        count = countResult(target),

        str = isLink
            ? count + ". " + content
            : tracker['name'] + " : " + label,

        listDiv,
        strPrefix = "<span class='tracker-line'>",
        strPrefixOdd = "<span class='tracker-line tracker-line-odd'>",
        strLinkPrefix = "<span class='tracker-line tracker-link' title='" + content + "'>",
        strLinkPrefixOdd = "<span class='tracker-line tracker-link tracker-line-odd' title='" + content + "'>",
        strSuffix = "</span>",

        targetPrefix = isLink ? strLinkPrefix : strPrefix,
        targetPrefixOdd = isLink ? strLinkPrefixOdd : strPrefixOdd;

    if (isLink) {
        // url 排重
        result[target][content] = true;
    }

    result[target][tracker['trackerId']] = tracker;

    switch (target) {

        case TRACKER:
            listDiv = trackerListDiv;
            break;
        case TRACKER_LINK:
            listDiv = trackerLinkListDiv;
            break;
        case HEAT_MAP:
            listDiv = heatMapListDiv;
            break;
        case HEAT_MAP_LINK:
            listDiv = heatMapLinkListDiv;
            break;

        default:
            break;
    }

    if ((result[target]["lines"] % 2) == 0) {
        str = targetPrefixOdd + str + strSuffix;
    } else {
        str = targetPrefix + str + strSuffix;
    }

    listDiv.append(str + "<br>");
}

/****************************************调试*********************************************/

// 开启/关闭调试
function changeDebugModal(isDebug) {
    if (isDebug) {
        showDebug();
    } else {
        hideDebug();
    }
}

function showDebug() {
    $("#changeDebugModal").html("关闭调试");
    $("#tools-debug").show();
}

function hideDebug() {
    $("#changeDebugModal").html("开启调试");
    $("#tools-debug").hide();
}

// 调试HAR
$("button#debugHAR").on("click", function () {
    chrome.devtools.network.getHAR(function (HARLog) {
            chrome.runtime.sendMessage(null,
                {
                    action: "dev-printHARLog",
                    harLog: HARLog,
                    onlyJS: $("#onlyJS").prop("checked")
                }
            );
        }
    );
});

// 打印调试信息
function printDevFn() {
    chrome.runtime.sendMessage(null, {
        action: 'dev-debugInfo',
        info: arguments
    });
}