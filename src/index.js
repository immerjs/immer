module.exports =
    typeof Proxy === "undefined" ? require("./es5") : require("./immer")
