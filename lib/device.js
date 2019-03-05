'use strict';

const Homey = require('homey');
const { deferred, delay, generateRandomString, encodeParams } = require('./utils');
const { EventEmitter } = require('events');
const mqtt = require('mqtt');
const crypto = require('crypto');
const request = require('request');
const assert = require('assert');

class Device extends Homey.Device {
    onInit() {
        var client = this._connect();
    }
    _connect() {
        this.uuid = this.getData().id
        this.key = this.getData().attributes.Meross_Key
        this.userId = this.getData().attributes.Meross_UserID
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
          keepalive: 30
        });
        console.log(`connected to ` + domain)
        return client
      }

}
module.exports = Device;