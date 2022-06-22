import { LLNG_Conf, Conf_Accessor } from '@lemonldap-ng/types'
import { hashParameters } from '@lemonldap-ng/constants'
import DBI from '@lemonldap-ng/conf-dbi'

type Serialized = { [key: string]: string | number | boolean }

class CDBI extends DBI implements Conf_Accessor {
  store (conf: LLNG_Conf) {
    const cfgNum: number = conf.cfgNum
    return new Promise<boolean>((resolve, reject) => {
      this.lastCfg().then(lastCfg => {
        this.db
          .transaction(async trx => {
            if (cfgNum == lastCfg) {
              await trx(this.table)
                .where('cfgNum', '=', lastCfg)
                .del()
            }
            const tmp = this.serialize(conf)
            const fields: object[] = []
            Object.keys(tmp).forEach(k => {
              fields.push({ cfgNum: cfgNum, field: k, value: tmp[k] })
            })
            await trx(this.table).insert(fields)
          })
          .then(() => resolve(true))
          .catch(e => reject(e))
      })
    })
  }

  load (cfgNum: number, fields: string[] = ['*']) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      this.db
        .select('field', 'value')
        .from(this.table)
        .where('cfgNum', '=', cfgNum)
        .then(rows => {
          if (rows.length === 0) {
            reject(`Configuration ${cfgNum} not found`)
          } else {
            const res: Serialized = {}
            rows.map((row: { field: string; value: string }) => {
              res[row.field] = row.value
            })
            resolve(this.unserialize(res))
          }
        })
        .catch(e => {
          reject(e)
        })
    })
  }

  serialize (cfg: LLNG_Conf) {
    const res: Serialized = {}
    Object.keys(cfg).forEach(k => {
      res[k] = k.match(hashParameters) ? JSON.stringify(cfg[k]) : cfg[k]
    })
    return res
  }

  unserialize (cfg: Serialized) {
    // @ts-expect-error TS2741: Property 'cfgNum' is missing in type '{}' but required in type 'LLNG_Conf'
    const res: LLNG_Conf = {}
    Object.keys(cfg).forEach(k => {
      try {
        // @ts-expect-error TS2345: Argument of type 'string | number | boolean' is not assignable to parameter of type 'string'
        res[k] = k.match(hashParameters) ? JSON.parse(cfg[k]) : cfg[k]
      } catch (e) {
        throw new Error(`Error when parsing ${k} field: (${e})`)
      }
    })
    return res
  }
}

export default CDBI
