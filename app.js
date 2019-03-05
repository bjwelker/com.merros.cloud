'use strict';

const Homey = require('homey');
const _meross = require('./lib/meross.js')

class Meross extends Homey.App {

    onInit() {
        var self = this;
        this.log('Started Meross Cloud...');
        var settings = this.getSettings();
        this.log("Running with User " + settings.meross_email);

        this.meross = new _meross(settings.meross_email, settings.meross_password, this.log);
    }

    getSettings() {
        return {
            "meross_email": Homey.ManagerSettings.get('meross_email'),
            "meross_password": Homey.ManagerSettings.get('meross_password')
        }
    }
}

module.exports = Meross;