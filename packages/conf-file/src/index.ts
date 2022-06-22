import fs from 'fs'
import path from 'path'
import { LLNG_Conf, Conf_Accessor } from '@lemonldap-ng/types'

export type FileArgs = {
  dirName: string
}

class FileConf implements Conf_Accessor {
  dirName: string

  constructor (args: FileArgs) {
    if (!args.dirName) {
      throw new Error("'dirName' is required in 'File' configuration type")
    }
    this.dirName = args.dirName
    if (!fs.lstatSync(this.dirName).isDirectory()) {
      throw new Error(`Directory ${this.dirName} doesn't exist`)
    }
  }

  available () {
    return new Promise<number[]>((resolve, reject) => {
      fs.readdir(this.dirName, (err, files) => {
        if (err) {
          reject(err)
        } else {
          const res: number[] = []
          files.map(file => {
            if (/lmConf-(\d+)\.js/.test(file)) res.push(parseInt(RegExp.$1))
          })
          res.sort()
          resolve(res)
        }
      })
    })
  }

  lastCfg () {
    return new Promise<number>((resolve, reject) => {
      this.available()
        .then((av: number[]) => {
          if (av.length > 0) {
            // @ts-ignore: av contains only numbers, not undefined
            resolve(av.pop())
          } else {
            reject('No configuration available')
          }
        })
        .catch(err => {
          reject(err)
        })
    })
  }

  load (cfgNum: number, fields: string[] = []) {
    return new Promise<LLNG_Conf>((resolve, reject) => {
      const filename = path.join(this.dirName, `lmConf-${cfgNum.toString()}.json`)
      fs.access(filename, fs.constants.R_OK, err => {
        if (err) {
          reject(`Unable to read ${filename}: ${err}`)
        } else {
          fs.readFile(filename, (err, data) => {
            if (err) {
              reject(`Unable to read ${filename}: ${err}`)
            } else {
              try {
                return resolve(JSON.parse(data.toString()))
              } catch (err) {
                reject(`JSON parsing error: ${err}`)
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
      const data = JSON.stringify(fields)
      fs.writeFile(
        path.join(this.dirName, `lmConf-${fields.cfgNum.toString()}.json`),
        data,
        err => {
          process.umask(mask)
          if (err) {
            reject(`Unable to write lmConf-${fields.cfgNum.toString()}.json`)
          } else {
            resolve(true)
          }
        }
      )
    })
  }
}

export default FileConf
