// @author: Chen3861229
// @date: 2024-04-19
// NJS events

function njsOnExit(r, callbacks) {
  const eventName = "exit";
  if (callbacks && Array.isArray(callbacks)) {
    callbacks.map(callback => {
      njsOn(eventName, callback);
    });
  }
  njsOn(eventName, () => {
    njsOnExitNotice(r);
  });
}

function njsOn(eventName, callback) {
  njs.on(eventName, callback);
}

function njsOnExitNotice(r) {
  r.warn(`=== the NJS VM is destroyed ===`);
}

export default {
  njsOnExit,
  njsOn,
};