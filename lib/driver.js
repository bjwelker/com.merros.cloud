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
                console.log('New Device ' + dev.devName + ' - Type ' + dev.deviceType);
                if (dev.deviceType === this.merossType) {
                    console.log("Match " + this.merossType);
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
                return callback(null, devices);
            });
        });
    }

}

module.exports = Driver;