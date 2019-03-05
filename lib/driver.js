'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    onInit() {

    }

    onPairListDevices(data, callback) {

        let devices = [];
        let devices_grouped = [];

        Homey.app.meross.listDevices((err, MerossdevList) => {
            MerossdevList.forEach((dev) => {
                if (dev.deviceType === this.merossType) {
                    let device = {
                        "name": dev.devName,
                        "capabilities": this.capabilities,
                        "data": {
                            "id": dev.uuid,
                            "attributes": {
                            }
                        }
                    }
                    devices.push(device);
                }
            });
            callback(null, devices);
        });
    }

}

module.exports = Driver;