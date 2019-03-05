'use strict';

const Homey = require('homey');

class Driver extends Homey.Driver {

    onInit() {

    }

    onPairListDevices(data, callback) {

        let devices = [];
        let devices_grouped = [];

        //Homey.app.meross.listDevices();
        Homey.app.meross.listDevices().then((data) => {
            devList.forEach((dev) => {
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
            callback(null, devices);

        }).catch((err) => {
        });
    });
}

}

module.exports = Driver;