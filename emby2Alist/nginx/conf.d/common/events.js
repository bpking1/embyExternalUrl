// @author: Chen3861229
// @date: 2024-04-19
// NJS events

function njsOnExit(mark, callbacks, r) {
  const eventName = "exit";
  if (callbacks && Array.isArray(callbacks)) {
    callbacks.map(callback => {
      njsOn(eventName, callback);
    });
  }
  njsOn(eventName, () => {
    njsOnExitNotice(mark);
  });
}

function njsOn(eventName, callback) {
  njs.on(eventName, callback);
}

function njsOnExitNotice(mark) {
  ngx.log(ngx.WARN, `=== ${mark}, the NJS VM is destroyed ===`);
}

export default {
  njsOnExit,
  njsOn,
};