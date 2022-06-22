import fs from 'fs'
import path from 'path'
import yaml from 'js-yaml'
import FileConf from '@lemonldap-ng/conf-file'
import { LLNG_Conf, Conf_Accessor } from '@lemonldap-ng/types'

import { FileArgs } from '@lemonldap-ng/conf-file'

class YAMLConf extends FileConf implements Conf_Accessor {
  dirName: string

  constructor (args: FileArgs) {
    super(args)
    this.dirName = args.dirName
  }

  available () {
    return new Promise<number[]>((resolve, reject) => {
      fs.readdir(this.dirName, (err, files) => {
        if (err) {
          reject(err)
        } else {
          const res: number[] = []
          files.map(file => {
            if (/lmConf-(\d+)\.yaml/.test(file)) res.push(parseInt(RegExp.$1))
          })
          res.sort()
          resolve(res)
        }
      })
    })
  }

  load (cfgNum: number, fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      const filename = path.join(
        this.dirName,
        `lmConf-${cfgNum.toString()}.yaml`
      )
      fs.access(filename, fs.constants.R_OK, err => {
        if (err) {
          reject(`Unable to read ${filename}: ${err}`)
        } else {
          fs.readFile(filename, (err, data) => {
            if (err) {
              reject(`Unable to read ${filename}: ${err}`)
            } else {
              try {
                return resolve(yaml.load(data.toString()) as LLNG_Conf)
              } catch (err) {
                reject(`YAML parsing error: ${err}`)
              }
            }
          })
        }
      })
    })
  }

  store (fields: LLNG_Conf) {
    return new Promise<boolean>((resolve, reject) => {
      const mask = process.umask(0o027)
      const data = yaml.dump(fields)
      fs.writeFile(
        path.join(this.dirName, `lmConf-${fields.cfgNum.toString()}.yaml`),
        data,
        err => {
          process.umask(mask)
          if (err) {
            reject(`Unable to write lmConf-${fields.cfgNum.toString()}.yaml`)
          } else {
            resolve(true)
          }
        }
      )
    })
  }
}

export default YAMLConf
