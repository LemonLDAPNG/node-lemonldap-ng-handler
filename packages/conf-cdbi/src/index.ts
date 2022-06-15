import type { DBI_Args, Schema } from '@LLNG/conf-dbi';
import { LLNG_Conf, Conf_Accessor } from '@LLNG/types';

import DBI from '@LLNG/conf-dbi';

class CDBI extends DBI implements Conf_Accessor {

  store(fields: LLNG_Conf) {
    let cfgNum: number = fields.cfgNum;
    let data = JSON.stringify(fields);
    return new Promise<boolean>((resolve,reject) => {
      this.lastCfg().then( lastCfg => {
        if( cfgNum == lastCfg ) {
          this.db(this.table)
            .where('cfgNum','=',cfgNum)
            .update({
              data: data
            })
            .then( () => {resolve(true)} )
            .catch( (e) => {reject(e)} )
        }
        else {
          this.db(this.table).insert({
              cfgNum: cfgNum,
              data: data
            })
            .then( () => {resolve(true)} )
            .catch( (e) => {reject(e)} )
        }
      });
    });
  }

  load(cfgNum: number, fields: string[] = ['*']) {
    return new Promise<LLNG_Conf>((resolve,reject) => {
      this.db
        .select('data')
        .from(this.table)
        .where('cfgNum','=',cfgNum)
        .then( row => {
          if(row.length != 1) {
            reject(`Configuration ${cfgNum} not found`);
          } else {
            resolve(JSON.parse(row[0].data));
          }
        })
        .catch( e => {
          reject(e);
        });
    })
  }
}

export default CDBI;
