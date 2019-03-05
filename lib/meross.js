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
                console.log(body);
                body = JSON.parse(body);

                if (body.info === 'Success') {
                    console.log('All Good');
                    //console.log(JSON.stringify(body.data, null, 2));
                    return callback(null, body.data);
                }
                return callback(new Error(body.apiStatus + ': ' + body.info));
            }
            return callback(error);
        });
    }
    async connect({ retry = true, retries = null, retryInterval = 5000, callback } = {}) {
        const data = { "email": this.option.email, "password": this.option.password };

        this.authenticatedPost(LOGIN_URL, data, (err, loginResponse) => {
            console.log(loginResponse);
            if (err) {
                callback && callback(err);
                return;
            }
            this.token = loginResponse.token;
            this.key = loginResponse.key;
            this.userId = loginResponse.userid;
            this.userEmail = loginResponse.email;
            this.authenticated = true;
        });
        let initialRetries = retries;
        while (true) {
            try {
                this.client = await this._connect();
                this.setOnline(true);
                this.hasEnded = false;

                // handle disconnects.
                this.client.on('offline', async () => {
                    this.debug('connection lost, will retry...');
                    this.end();
                    await delay(retryInterval);
                    await this.connect({ retry, initialRetries, retryInterval });
                });

                // Start message loop.
                return this.messageLoop();
            } catch (e) {
                if (e.message !== 'CONNECTION_FAILED' || !retry) {
                    throw e;
                }
                // Retry.
                if (retry) {
                    if (retries !== null && --retries <= 0) {
                        throw e;
                    }
                    this.debug('retrying MQTT broker' + (retries === null ? '' : `, ${retries} retries left`));
                    await delay(retryInterval);
                }
            }
        }
    }


    _connect() {
        const domain = "eu-iot.meross.com";
        const appId = crypto.createHash('md5').update('API' + this.uuid).digest("hex");
        const clientId = 'app:' + appId;

        // Password is calculated as the MD5 of USERID concatenated with KEY
        const hashedPassword = crypto.createHash('md5').update(this.userId + this.key).digest("hex");
        let defer = deferred();
        let client = mqtt.connect({
            protocol: 'mqtts',
            host: domain,
            port: 2001,
            clientId: clientId,
            username: this.userId,
            password: hashedPassword,
            rejectUnauthorized: true,
            keepalive: 30,
            ...this.opts.mqttOptions
        }).once('connect', () => {
            this.debug(`connected to ${host}:${port}`);
            defer.resolve(client)
        }).once('error', err => {
            client.end();
            defer.reject(err);
        }).once('offline', () => {
            client.end();
            defer.reject(Error('CONNECTION_FAILED'));
        });
        return defer.promise;
    }

    listDevices(callback) {
        var self = this;
        var allDevices = [];
        //let merossDevices;
        /*Object.keys(this.interfaceConfigs).forEach((interfaceName) => {
            allDevices.push(self.connections[interfaceName].listDevices())
        })*/


        /*return new Promise(function (resolve, reject) {
            Promise.all().then((results) => {*/
                const data = { "email": this.MEROSS_EMAIL, "password": this.MEROSS_PASSWORD };
                this.authenticatedPost(LOGIN_URL, data, (err, loginResponse) => {
                    //console.log(loginResponse);
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
                        console.log("Inside: " + devList);
                        /*devList.forEach((dev) => {
                            let uuid = dev.uuid;
                            console.log('New Device ' + dev.devName + ' - Type ' + dev.deviceType);
                        });*/
                        return callback(null, devList);
                    });
                });
                /*resolve(devList)
            }).catch((err) => {
                reject(err)
            })
        })*/
        //console.log("Outside: " + JSON.stringify(merossDevices));
        //return merossDevices;
    }
}
module.exports = Meross;