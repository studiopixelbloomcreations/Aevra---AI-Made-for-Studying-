const { proxyVis } = require("./_vis_proxy");

exports.handler = async function handler(event) {
  return proxyVis(event, "/detect-face");
};
