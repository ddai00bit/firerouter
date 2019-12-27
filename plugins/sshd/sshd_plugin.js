/*    Copyright 2019 Firewalla Inc
 *
 *    This program is free software: you can redistribute it and/or modify
 *    it under the terms of the GNU Affero General Public License, version 3,
 *    as published by the Free Software Foundation.
 *
 *    This program is distributed in the hope that it will be useful,
 *    but WITHOUT ANY WARRANTY; without even the implied warranty of
 *    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *    GNU Affero General Public License for more details.
 *
 *    You should have received a copy of the GNU Affero General Public License
 *    along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

const Plugin = require('../plugin.js');
const exec = require('child-process-promise').exec;
const util = require('../../util/util.js');
const pl = require('../plugin_loader.js');
const r = require('../../util/firerouter');
const fs = require('fs');
const Promise = require('bluebird');
Promise.promisifyAll(fs);


class SSHDPlugin extends Plugin {

  static async preparePlugin() {
    await exec(`mkdir -p ${r.getUserConfigFolder()}/sshd`)
    await super.preparePlugin();
  }

  async flush() {
    this.log.info("Flushing SSHD", this.name);
    const confPath = this._getConfFilePath();
    await fs.unlinkAsync(confPath).catch((err) => {});
    await this.reloadSSHD().catch((err) => {});
  }

  async reloadSSHD() {
    await exec(`${__dirname}/reload_sshd.sh`);
  }

  _getConfFilePath() {
    return `${r.getUserConfigFolder()}/sshd/sshd_config.${this.name}`;
  }

  async generateConfFile() {
    const confPath = this._getConfFilePath();
    const iface = this.name;
    const ifacePlugin = pl.getPluginInstance("interface", iface);
    if (ifacePlugin) {
      this.subscribeChangeFrom(ifacePlugin);
      const state = await ifacePlugin.state();
      if (state && state.ip4) {
        const ipv4Addr = state.ip4.split("/")[0];
        await fs.writeFileAsync(confPath, `ListenAddress ${ipv4Addr}`, {encoding: 'utf8'});
      } else {
        this.fatal("Failed to get ip4 of interface " + iface);
      }
    } else {
      this.fatal("Cannot find interface plugin " + iface);
    }
  }

  async apply() {
    if (this.networkConfig.enabled) {
      await this.generateConfFile();
      await this.reloadSSHD();
    } else {
      const confPath = this._getConfFilePath();
      await fs.unlinkAsync(confPath).catch((err) => {});
      await this.reloadSSHD();
    }
  }
}

module.exports = SSHDPlugin;