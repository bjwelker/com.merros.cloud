module.exports.deferred = function deferred() {
    let deferred = {};
    deferred.promise = new Promise((resolve, reject) => {
      deferred.resolve = resolve;
      deferred.reject  = reject;
    });
    return deferred;
  }
  
  module.exports.delay = function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  module.exports.isObject = function isObject(x) {
    return typeof x === 'object' && x !== null;
  };
  
  module.exports.lc = function lc(s) {
    return String(s).toLowerCase();
  };
  
  module.exports.generateRandomString = function generateRandomString(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    while (nonce.length < length) {
        nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }
  
  module.exports.encodeParams = function encodeParams(parameters) {
    const jsonstring = JSON.stringify(parameters);
    return Buffer.from(jsonstring).toString('base64');
  }