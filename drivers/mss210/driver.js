'use strict';

const Homey = require('homey');
const Driver = require('../../lib/driver.js');

class MerossDriver extends Driver {

    onInit() {
        super.onInit();
        this.capabilities = [
            'onoff'
        ]
        this.merossType = 'mss210'
        this.log(this.merossType, 'has been inited');
    }


}

module.exports = MerossDriver;