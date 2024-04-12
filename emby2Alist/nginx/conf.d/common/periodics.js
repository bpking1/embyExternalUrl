// @author: Chen3861229
// @date: 2024-04-12
// global schedule task

// import config from "./constant.js";
// import util from "./util.js";

const fs = require("fs");

async function logHandler(s) {
  const errorLogPath = ngx.error_log_path;
  if (!fs.existsSync(errorLogPath)) {
    return;
  }
  const timeLocal = s.variables["time_local"];
  // const dateLocal = s.variables["date_local"];
  fs.writeFileSync(errorLogPath, "");
  ngx.log(ngx.WARN, `cleared by periodics.logHandler`);

  const accessLogPath = errorLogPath.replace("error", "access");
  if (fs.existsSync(accessLogPath)) {
    fs.writeFileSync(accessLogPath, `${timeLocal}: js: cleared by periodics.logHandler\n`);
  }
}

export default {
  logHandler,
};