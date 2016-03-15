var port = chrome.runtime.connect({name: 'devtools'});

port.postMessage({
    action: 'dev-checkLogin'
});

port.onMessage.addListener(function (msg) {

    switch (msg["action"]) {

        case "dev-checkLogin":
            if (msg['isLogin'] === true) {
                chrome.devtools.panels.create("Track", "", "/track/track.html", function (panel) {
                    // ...
                });
            }
            break;

        default:
            break;
    }
});