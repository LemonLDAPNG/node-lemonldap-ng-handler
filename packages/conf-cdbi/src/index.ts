import { LLNG_Conf, Conf_Accessor } from '@lemonldap-ng/types'

import DBI from '@lemonldap-ng/conf-dbi'

class CDBI extends DBI implements Conf_Accessor {
  store (fields: LLNG_Conf) {
    const cfgNum: number = fields.cfgNum
    const data = JSON.stringify(fields)
    return new Promise<boolean>((resolve, reject) => {
      this.lastCfg().then(lastCfg => {
        if (cfgNum == lastCfg) {
          this.db(this.table)
            .where('cfgNum', '=', cfgNum)
            .update({
              data: data
            })
            .then(() => {
              resolve(true)
            })
            .catch(e => {
              // istanbul ignore next
              reject(e)
            })
        } else {
          this.db(this.table)
            .insert({
              cfgNum: cfgNum,
              data: data
            })
            .then(() => {
              resolve(true)
            })
            .catch(e => {
              // istanbul ignore next
              reject(e)
            })
        }
      })
    })
  }

  // eslint-disable-next-line no-unused-vars
  load (cfgNum: number, fields: string[] = ['*']) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.db
        .select('data')
        .from(this.table)
        .where('cfgNum', '=', cfgNum)
        .then(row => {
          if (row.length != 1) {
            reject(`Configuration ${cfgNum} not found`)
          } else {
            resolve(JSON.parse(row[0].data))
          }
        })
        .catch(e => {
          // istanbul ignore next
          reject(e)
        })
    })
  }
}

export default CDBI
