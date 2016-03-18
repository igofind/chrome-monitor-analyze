/**************************************工具栏**********************************************/
var port = chrome.runtime.connect({name: "track-connect-background"});

var
    trackers = null,

    trackerResult = {},// 记录HAR分析结果(排重用)
    resultLines = 0,

    trackerLinks = {},// 记录HTTP请求分析结果(排重用)
    linkLines = 0,

    trackerHeatMaps = {},// 记录HTTP请求(热力图)分析结果(排重用)
    heatMapLines = 0;

var
    trackDiv = $("div#result-track"),
    trackListDiv = $("div#result-tracker-list"),
    trackerCntSpan = $("#result-span"),

    linkDiv = $("div#result-link"),
    linkListDiv = $("div#result-tracker-link"),

    heatMapDiv = $("div#result-heatMap"),
    heatMapListDiv = $("div#result-heatMap-list"),
    heatMapCntSpan = $("#result-span-heatMap");

// 解析
$("button#analyze").on("click", function () {

    printDevFn("click:解析");

    // 日志相关
    port.postMessage({action: "track-sendLog", tabId: chrome.devtools.inspectedWindow.tabId});

    // 开始前先清空所有遗留结果
    clearAllResult();

    // 检测Tracker
    showResultCount();

    // 检测Tracker相关的http请求
    showResultLink();

    // 检测heatMap相关的http请求
    showHeatMapResult();

    chrome.devtools.inspectedWindow.getResources(function (arrs) {

        for (var i = 0; i < arrs.length; i++) {

            var arr = arrs[i],
                url = arr['url'],
                type = arr['type'];

            switch (type) {

                case "document":
                case "script":
                    arr.getContent(function (content, encoding) {
                        doMain(content);
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
    printDevFn("click:refreshPage");
    chrome.devtools.inspectedWindow.reload();
});

// 开启/关闭调试
$("button#changeDebugModal").on("click", function () {
    printDevFn("click:开启/关闭调试");
    port.postMessage({action: 'track-changeDebugModal'});
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
    var mt = request.response.content.mimeType;

    if ($("#onlyJS").prop("checked") && (mt == "text/javascript" || mt == "application/javascript")) {

        printDevFn(request.request.url);
    } else if (!$("#onlyJS").prop("checked")) {

        printDevFn(request.request.url);
    }

    doLink(request);

    // heat map
    doHeatMap(request);
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

// 主要分析逻辑(单独分析每个js)
function doMain(content) {

    var length = trackers.length;

    for (var i = 0; i < length; i++) {
        var tracker = trackers[i],
            trackerId = tracker['trackerId'],
            labels = tracker["label"].split(";");

        if (!tracker["label"]) {
            continue;
        }

        for (var j = 0; j < labels.length; j++) {

            if (labels[j] === null || labels[j] === "" || labels[j].trim() === "") {
                continue;
            }

            if (contentcontent.indexOf(labels[j]) != -1 && !trackerResult[trackerId]) {

                resultLines++;

                countTracker();

                trackerResult[trackerId] = tracker;

                if ((resultLines % 2) == 0) {
                    writeToTracker("<span class='tracker-line tracker-line-odd'>" + tracker['name'] + "：" + labels[j] + "</span>");
                } else {
                    writeToTracker("<span class='tracker-line'>" + tracker['name'] + "：" + labels[j] + "</span>");
                }
            }
        }
    }
}

// 检测所有发送的http请求
function doLink(request) {

    var
        url = request.request.url,
        length = trackers.length;

    for (var i = 0; i < length; i++) {
        var tracker = trackers[i],
            trackerId = tracker['trackerId'],
            labels = tracker["label"].split(";");

        if (!tracker["label"]) {
            continue;
        }

        for (var j = 0; j < labels.length; j++) {

            if (labels[j] === null || labels[j] === "" || labels[j].trim() === "") {
                continue;
            }

            if (url.indexOf(labels[j]) != -1 && !trackerLinks[trackerId]) {

                linkLines++;

                trackerLinks[trackerId] = tracker;

                // TODO 注：http请求检测可以补充遗漏的Tracker
                if (!trackerResult[trackerId]) {

                    resultLines++;
                    countTracker();

                    if ((resultLines % 2) == 0) {
                        writeToTracker("<span class='tracker-line tracker-line-odd'>" + tracker['name'] + "：" + labels[j] + "</span>");
                    } else {
                        writeToTracker("<span class='tracker-line'>" + tracker['name'] + "：" + labels[j] + "</span>");
                    }
                }

                if ((linkLines % 2) == 0) {
                    writeToLink("<span class='tracker-line tracker-line-odd'>" + url + "</span>");
                } else {
                    writeToLink("<span class='tracker-line'>" + url + "</span>");
                }
            }
        }
    }
}

function doHeatMap(request) {

    var
        url = request.request.url,
        length = trackers.length;

    for (var i = 0; i < length; i++) {
        var tracker = trackers[i],
            trackerId = tracker['trackerId'];

        if (!tracker['heatMap']) {
            continue;
        }

        var heatMaps = tracker["heatMap"].split(";");

        for (var j = 0; j < heatMaps.length; j++) {

            if (url.indexOf(heatMaps[j]) != -1 && !trackerHeatMaps[trackerId]) {

                heatMapLines++;

                countHeatMap();

                trackerHeatMaps[trackerId] = tracker;

                if ((heatMapLines % 2) == 0) {
                    writeToHeatMap("<span class='tracker-line tracker-line-odd'>" + tracker['name'] + "：" + heatMaps[j] + "</span>");
                } else {
                    writeToHeatMap("<span class='tracker-line'>" + tracker['name'] + "：" + heatMaps[j] + "</span>");
                }
            }
        }
    }
}

// 清理所有的监测结果
function clearAllResult() {
    // Tracker
    trackerResult = {};
    resultLines = 0;

    trackDiv.hide();
    trackListDiv.html("");
    trackerCntSpan.data("countTracker", 0).html(0);

    // link
    trackerLinks = {};
    linkLines = 0;

    linkDiv.hide();
    linkListDiv.html("");

    // Tracker
    trackerHeatMaps = {};
    heatMapLines = 0;

    heatMapDiv.hide();
    heatMapListDiv.html("");
    heatMapCntSpan.data("countTracker", 0).html(0);
}

// #result-total, #result-link-total, #result-heatMap-total 折叠和展开
$("#result-total").on("click", function () {
    trackListDiv.slideToggle("normal");
});
$("#result-link-total").on("click", function () {
    linkListDiv.slideToggle("normal");
});
$("#result-heatMap-total").on("click", function () {
    heatMapListDiv.slideToggle("normal");
});

function showResultCount() {
    trackDiv.show();
}

function showResultLink() {
    linkDiv.show();
}

function showHeatMapResult() {
    heatMapDiv.show();
}

// 输出结果统计
function countTracker() {
    var count = trackerCntSpan.data("countTracker");

    count = count ? count + 1 : 1;

    trackerCntSpan.data("countTracker", count);
    trackerCntSpan.html(count);
}

// 输出结果统计
function countHeatMap() {
    var count = trackerCntSpan.data("countHeatMap");

    count = count ? count + 1 : 1;

    heatMapCntSpan.data("countHeatMap", count);
    heatMapCntSpan.html(count);
}

// 输出到页面监测结果区域中
function writeToTracker(str) {
    trackListDiv.append(str + "<br>");
}

// 输出到页面http请求监测结果区域中
function writeToLink(str) {
    linkListDiv.append(str + "<br>");
}

// 输出到页面http请求监测结果区域中
function writeToHeatMap(str) {
    heatMapListDiv.append(str + "<br>");
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