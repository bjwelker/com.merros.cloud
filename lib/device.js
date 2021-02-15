'use strict';

const Homey = require('homey');
const EventEmitter = require('events');
class MyEmitter extends EventEmitter { }
const myEmitter = new MyEmitter();
const mqtt = require('mqtt');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { generateRandomString } = require('./utils');
//const appId = crypto.createHash('md5').update('API' + this.uuid + Math.floor(Math.random() * 100)).digest("hex");
const appId = crypto.createHash('md5').update('API' + uuidv4()).digest("hex");

class Device extends Homey.Device {
  onInit() {
    this.clientResponseTopic = null;
    this.waitingMessageIds = {};
    this.uuid = this.getData().id
    this.key = this.getData().attributes.Meross_Key;
    this.userId = this.getData().attributes.Meross_UserID;

    const domain = "eu-iot.meross.com";
    const clientId = 'app:' + appId;

    this.registerCapabilityListener('onoff', (value, opts) => {
      console.log('value listner', value);
      console.log('opts listner', opts);
      value = Number(value);
      value = this.convertValue('int', value);
      console.log('value converted listner', value);
      this.controlToggle(value, (err, res) => {
        console.log('Toggle Response: err: ' + err + ', res: ' + JSON.stringify(res));;

      });
      return Promise.resolve();
    });

    this.on('data', (namespace, payload) => {
      console.log('Device: ' + this.uuid + ' ' + namespace + ' - data: ' + JSON.stringify(payload));
      switch (namespace) {
        case 'Appliance.Control.ToggleX':
          this.setValuesToggleX(this.uuid, payload);
          break;
        case 'Appliance.Control.Toggle':
          this.setValuesToggle(this.uuid, payload);
          break;
        case 'Appliance.System.Online':
          //adapter.setState(this.uuid + '.online', (payload.online.status === 1), true);
          break;
        case 'Appliance.Control.Upgrade':
        case 'Appliance.System.Report':
        case 'Appliance.Control.ConsumptionX':
          break;

        default:
          console.log('Received unknown data ' + namespace + ': ' + JSON.stringify(payload));
          console.log('Please send full line from logfile on disk to developer');
      }
    });
    // Password is calculated as the MD5 of USERID concatenated with KEY
    const hashedPassword = crypto.createHash('md5').update(this.userId + this.key).digest("hex");

    this.client = mqtt.connect({
      'protocol': 'mqtts',
      'host': domain,
      'port': 2001,
      'clientId': clientId,
      'username': this.userId,
      'password': hashedPassword,
      'rejectUnauthorized': true,
      'keepalive': 30,
      'reconnectPeriod': 5000

    });

    this.client.on('connect', () => {

      //console.log("Connected. Subscribe to user topics");

      this.client.subscribe('/app/' + this.userId + '/subscribe', (err) => {
        if (err) {
          this.emit('error', err);
        }
        //console.log('User Subscribe Done');
      });

      this.clientResponseTopic = '/app/' + this.userId + '-' + appId + '/subscribe';

      this.client.subscribe(this.clientResponseTopic, (err) => {
        if (err) {
          this.emit('error', err);
        }
        //console.log('User Response Subscribe Done');
      });
      this.emit('connected');
    });

    this.client.on('message', (topic, message) => {
      // message is Buffer
      console.log(topic + ' <-- ' + message.toString());
      message = JSON.parse(message.toString());
      if (message.header.from && !message.header.from.includes(this.uuid)) return;
      // {"header":{"messageId":"14b4951d0627ea904dd8685c480b7b2e","namespace":"Appliance.Control.ToggleX","method":"PUSH","payloadVersion":1,"from":"/appliance/1806299596727829081434298f15a991/publish","timestamp":1539602435,"timestampMs":427,"sign":"f33bb034ac2d5d39289e6fa3dcead081"},"payload":{"togglex":[{"channel":0,"onoff":0,"lmTime":1539602434},{"channel":1,"onoff":0,"lmTime":1539602434},{"channel":2,"onoff":0,"lmTime":1539602434},{"channel":3,"onoff":0,"lmTime":1539602434},{"channel":4,"onoff":0,"lmTime":1539602434}]}}

      // If the message is the RESP for some previous action, process return the control to the "stopped" method.
      if (this.waitingMessageIds[message.header.messageId]) {
        if (this.waitingMessageIds[message.header.messageId].timeout) {
          clearTimeout(this.waitingMessageIds[message.header.messageId].timeout);
        }
        this.waitingMessageIds[message.header.messageId].callback(null, message.payload || message);
        delete this.waitingMessageIds[message.header.messageId];
      }
      else if (message.header.method === "PUSH") { // Otherwise process it accordingly
        const namespace = message.header ? message.header.namespace : '';
        //console.log("Found message");
        this.emit('data', namespace, message.payload || message);
      }
      this.emit('rawData', message);
    });
    this.client.on('error', (error) => {
      this.emit('error', error.toString());
    });
    this.client.on('close', (error) => {
      //console.log("Client close");
    });
    this.client.on('reconnect', () => {
      this.emit('reconnect');
      //console.log("reconnect");
    });

    /* Init Device */
    this.getOnlineStatus((err, res) => {
      //console.log("Getting Online Status");
      console.log('Online: ' + JSON.stringify(res));
    });

    this.getSystemAllData((err, deviceAllData) => {
      if (err || !deviceAllData) {
        console.log('Can not get Data for Device ' + this.uuid + ': ' + err);
        return;
      }
      this.setValuesToggle(this.uuid, deviceAllData.all.digest);
    });

    this.getSystemAbilities((err, deviceAbilities) => {
      console.log(this.uuid + ' Abilities: ' + JSON.stringify(deviceAbilities));
      if (err || !deviceAbilities) {
        console.log('Can not get Abilities for Device ' + this.uuid + ': ' + err);
        return;
      }
    });
  }

  publishMessage(method, namespace, payload, callback) {
    // if not subscribed und so ...
    this.key = this.getData().attributes.Meross_Key;
    this.userId = this.getData().attributes.Meross_UserID;
    this.clientResponseTopic = '/app/' + this.userId + '-' + appId + '/subscribe';
    console.log(this.clientResponseTopic);
    const messageId = crypto.createHash('md5').update(generateRandomString(16)).digest("hex");
    const timestamp = Math.round(new Date().getTime() / 1000);  //int(round(time.time()))

    const signature = crypto.createHash('md5').update(messageId + this.key + timestamp).digest("hex");

    const data = {
      "header": {
        "from": this.clientResponseTopic,
        "messageId": messageId, // Example: "122e3e47835fefcd8aaf22d13ce21859"
        "method": method, // Example: "GET",
        "namespace": namespace, // Example: "Appliance.System.All",
        "payloadVersion": 1,
        "sign": signature, // Example: "b4236ac6fb399e70c3d61e98fcb68b74",
        "timestamp": timestamp
      },
      "payload": payload
    };
    this.client.publish('/appliance/' + this.getData().id + '/subscribe', JSON.stringify(data));
    if (callback) {
      this.waitingMessageIds[messageId] = {};
      this.waitingMessageIds[messageId].callback = callback;
      this.waitingMessageIds[messageId].timeout = setTimeout(() => {
        //console.log('TIMEOUT');
        if (this.waitingMessageIds[messageId].callback) {
          this.waitingMessageIds[messageId].callback(new Error('Timeout'));
        }
        delete this.waitingMessageIds[messageId];
      }, 20000);
    }
    return messageId;
  }

  getOnlineStatus(callback) {
    return this.publishMessage("GET", "Appliance.System.Online", {}, callback);
  }

  controlToggle(onoff, callback) {
    onoff = this.convertValue('int', onoff);
    const payload = { "toggle": { "onoff": onoff ? 1 : 0 } };
    console.log("Payload: " + JSON.stringify(payload));
    return this.publishMessage("SET", "Appliance.Control.Toggle", payload, callback);
  }

  controlToggleX(channel, onoff, callback) {
    const payload = { "togglex": { "channel": channel, "onoff": onoff ? 1 : 0 } };
    console.log("Payload: " + JSON.stringify(payload));
    return this.publishMessage("SET", "Appliance.Control.ToggleX", payload, callback);
  }

  setValuesToggle(deviceId, payload) {
    // {"toggle":{"onoff":1,"lmTime":1542311107}}
    if (payload && payload.toggle) {
      payload.toggle.onoff = this.convertValue('boolean', payload.toggle.onoff);
      this.setCapabilityValue('onoff', payload.toggle.onoff);
      console.log("Toggle Set new State:" + payload.toggle.onoff)
      //adapter.setState(deviceId + '.0-switch', !!payload.toggle.onoff, true);
    }
  }

  setValuesToggleX(deviceId, payload) {
    // {"togglex":{"channel":1,"onoff":1,"lmTime":1540825748}} OR
    // {"togglex":[{"channel":0,"onoff":0,"lmTime":1542037296},{"channel":1,"onoff":0,"lmTime":1542037296},{"channel":2,"onoff":0,"lmTime":1542037296},{"channel":3,"onoff":0,"lmTime":1542037296},{"channel":4,"onoff":0,"lmTime":1542037296}]}
    if (payload && payload.togglex) {
      if (!Array.isArray(payload.togglex)) {
        payload.togglex = [payload.togglex];
      }
      payload.togglex.forEach((val) => {
        //adapter.setState(deviceId + '.' + val.channel, !!val.onoff, true);
        val.onoff = this.convertValue('boolean', val.onoff);
        console.log("ToggleX Set new State: Channel - " + val.channel + " State : " + val.onoff)
        this.setCapabilityValue('onoff', val.onoff);
        console.log("ToggleX Capabilities: " + this.getCapabilityValue('onoff'));
      });
      //pollElectricity(deviceId, 2);
    }
  }

  getSystemAllData(callback) {
    // {"all":{"system":{"hardware":{"type":"mss425e","subType":"eu","version":"2.0.0","chipType":"mt7682","uuid":"1806299596727829081434298f15a991","macAddress":"34:29:8f:15:a9:91"},"firmware":{"version":"2.1.2","compileTime":"2018/08/13 10:42:53 GMT +08:00","wifiMac":"34:31:c4:73:3c:7f","innerIp":"192.168.178.86","server":"iot.meross.com","port":2001,"userId":64416},"time":{"timestamp":1539612975,"timezone":"Europe/Berlin","timeRule":[[1521939600,7200,1],[1540688400,3600,0],[1553994000,7200,1],[1572138000,3600,0],[1585443600,7200,1],[1603587600,3600,0],[1616893200,7200,1],[1635642000,3600,0],[1648342800,7200,1],[1667091600,3600,0],[1679792400,7200,1],[1698541200,3600,0],[1711846800,7200,1],[1729990800,3600,0],[1743296400,7200,1],[1761440400,3600,0],[1774746000,7200,1],[1792890000,3600,0],[1806195600,7200,1],[1824944400,3600,0]]},"online":{"status":1}},"digest":{"togglex":[{"channel":0,"onoff":0,"lmTime":1539608841},{"channel":1,"onoff":0,"lmTime":1539608841},{"channel":2,"onoff":0,"lmTime":1539608841},{"channel":3,"onoff":0,"lmTime":1539608841},{"channel":4,"onoff":0,"lmTime":1539608841}],"triggerx":[],"timerx":[]}}}

    return this.publishMessage("GET", "Appliance.System.All", {}, callback);
  }

  getControlElectricity(callback) {
    return this.publishMessage("GET", "Appliance.Control.Electricity", {}, callback);
  }

  getSystemAbilities(callback) {
    // {"payloadVersion":1,"ability":{"Appliance.Config.Key":{},"Appliance.Config.WifiList":{},"Appliance.Config.Wifi":{},"Appliance.Config.Trace":{},"Appliance.System.All":{},"Appliance.System.Hardware":{},"Appliance.System.Firmware":{},"Appliance.System.Debug":{},"Appliance.System.Online":{},"Appliance.System.Time":{},"Appliance.System.Ability":{},"Appliance.System.Runtime":{},"Appliance.System.Report":{},"Appliance.System.Position":{},"Appliance.System.DNDMode":{},"Appliance.Control.Multiple":{"maxCmdNum":5},"Appliance.Control.ToggleX":{},"Appliance.Control.TimerX":{"sunOffsetSupport":1},"Appliance.Control.TriggerX":{},"Appliance.Control.Bind":{},"Appliance.Control.Unbind":{},"Appliance.Control.Upgrade":{},"Appliance.Digest.TriggerX":{},"Appliance.Digest.TimerX":{}}}
    return this.publishMessage("GET", "Appliance.System.Ability", {}, callback);
  }

  convertValue(valueType, value) {
    if (valueType === 'string') {
      value = value.toString();
    } else if (valueType === 'int') {
      value = parseInt(value)
    } else if (valueType === 'float') {
      value = parseFloat(value)
    } else if (valueType === 'boolean') {
      if (value === 0) {
        value = false
      } else if (value === 1) {
        value = true
      }
    } else if (valueType === 'onOffDimGet') {
      if (value > 0) {
        value = true
      } else {
        value = false
      }
    } else if (valueType === 'onOffDimSet') {
      if (value === true) {
        value = 0.99
      } else {
        value = 0
      }
    } else if (valueType === 'Wh') {
      value = parseFloat(value) / 1000
    } else if (valueType === 'floatPercent') {
      value = parseFloat(value) * 100
    }
    return value;
  }

  disconnect(force) {
    this.client.end(force);
  }

}
module.exports = Device;