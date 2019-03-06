'use strict';

const Homey = require('homey');
const Device = require('../../lib/device.js')

const capabilityMap = {
    "onoff": {
        "channel": 1,
        "key": "STATE",
        "set": {
            "key": "STATE",
            "channel": 1
        }
    }
}

class MerossDevice extends Device {

    onInit() {
        super.onInit(capabilityMap);
    }
}

module.exports = MerossDevice;
