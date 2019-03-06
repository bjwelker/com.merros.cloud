/*global module:true, require:false*/

const EventEmitter = require('events');
const mqtt = require('mqtt');
const crypto = require('crypto');
const request = require('request');
const { deferred, delay, generateRandomString, encodeParams } = require('./utils');
const assert = require('assert');
const assertNotEnded = value => assert(value, 'client has already ended');

class MqttConnection extends EventEmitter {
    constructor(UUID, USERID, USERKEY, logger) {
        super();
        this.logger = logger;
        this.uuid = UUID;
        this.userId = USERID;
        this.key = USERKEY

        this.mqttClient = this.createMqttClient();
        this.loop = this.messageLoop(this.mqttClient);
    }

    createMqttClient() {
        var self = this;
        const domain = "eu-iot.meross.com";
        const appId = crypto.createHash('md5').update('API' + this.uuid).digest("hex");
        const clientId = 'app:' + appId;

        // Password is calculated as the MD5 of USERID concatenated with KEY
        const hashedPassword = crypto.createHash('md5').update(this.userId + this.key).digest("hex");
        let client = mqtt.connect({
            protocol: 'mqtts',
            host: domain,
            port: 2001,
            clientId: clientId,
            username: this.userId,
            password: hashedPassword,
            rejectUnauthorized: true,
            keepalive: 30
        }).once('connect', () => {
            this.debug(`connected to ${host}:${port}`);
            return client;
        }).once('error', err => {
            client.end();
            return err;
        }).once('offline', () => {
            client.end();
            return Error('CONNECTION_FAILED');
        });
    }

    messageLoop(mqttclient) {
        mqttclient.subscribe('app/' + this.userId + '/subscribe');
        mqttclient.subscribe('app/' + this.userId + '-' + '/subscribe');
        mqttclient.on('message', this.onMessage.bind(this));
        return this;
    }

    onMessage(topic, message) {
        console.log("Topic: " + topic)
        console.log("Message" + JSON.stringify(message));
        /*let [type, deviceName, command] = topic.split('/');

        // Check if we know for which device this message is.
        let device = this.devices[deviceName] || this.devices[ANY_DEVICE];
        if (!device) return;

        // Update the device's topic (typically this is already set, but for
        // ANY_DEVICE it may not have been set yet).
        device.setTopic(deviceName);

        // Try to parse message as JSON. If it fails, assume it's just a string.
        try {
            var payload = JSON.parse(message);
        } catch (e) {
            var payload = message.toString();
        }

        // Relay to device.
        device.onMessage(command, payload);
        */
    }
}