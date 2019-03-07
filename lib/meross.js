const EventEmitter = require('events');
const mqtt = require('mqtt');
const crypto = require('crypto');
const request = require('request');
const { deferred, delay, generateRandomString, encodeParams } = require('./utils');
const assert = require('assert');
const assertNotEnded = value => assert(value, 'client has already ended');
const SECRET = "23x17ahWarFH6w29";
const MEROSS_URL = "https://iot.meross.com";
const LOGIN_URL = MEROSS_URL + "/v1/Auth/Login";
const DEV_LIST = MEROSS_URL + "/v1/Device/devList";

class Meross extends EventEmitter {
    constructor(MEROSS_EMAIL, MEROSS_PASSWORD, logger) {
        super();
        this.logger = logger
        this.MEROSS_EMAIL = MEROSS_EMAIL;
        this.MEROSS_PASSWORD = MEROSS_PASSWORD;
        this.isOnline = false;
        this.hasEnded = false;
        this.connections = {};
    }

    authenticatedPost(url, paramsData, callback) {
        const nonce = generateRandomString(16);
        const timestampMillis = Date.now();
        const loginParams = encodeParams(paramsData);

        // Generate the md5-hash (called signature)
        const datatosign = SECRET + timestampMillis + nonce + loginParams;
        const md5hash = crypto.createHash('md5').update(datatosign).digest("hex");
        const headers = {
            "Authorization": "Basic " + (this.token || ''),
            "vender": "Meross",
            "AppVersion": "1.3.0",
            "AppLanguage": "EN",
            "User-Agent": "okhttp/3.6.0"
        };

        const payload = {
            'params': loginParams,
            'sign': md5hash,
            'timestamp': timestampMillis,
            'nonce': nonce
        };

        const options = {
            url: url,
            method: 'POST',
            headers: headers,
            form: payload
        };
        //console.log(options);
        // Perform the request.
        request(options, (error, response, body) => {
            if (!error && response.statusCode == 200) {
                //console.log(body);
                body = JSON.parse(body);

                if (body.info === 'Success') {
                    //console.log(JSON.stringify(body.data, null, 2));
                    return callback(null, body.data);
                }
                return callback(new Error(body.apiStatus + ': ' + body.info));
            }
            return callback(error);
        });
    }

    listDevices(callback) {

        const data = { "email": this.MEROSS_EMAIL, "password": this.MEROSS_PASSWORD };
        this.authenticatedPost(LOGIN_URL, data, (err, loginResponse) => {
            if (err) {
                callback && callback(err);
                return;
            }
            this.token = loginResponse.token;
            this.key = loginResponse.key;
            this.userId = loginResponse.userid;
            this.userEmail = loginResponse.email;
            this.authenticated = true;
            this.authenticatedPost(DEV_LIST, {}, (err, devList) => {
                return callback(null, devList, this.userId, this.key);
            });
        });
    }
}
module.exports = Meross;