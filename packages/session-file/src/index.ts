import { Apache_Session, LLNG_Session, Session_Accessor } from '@LLNG/types'
type SessionFile_Args = {
  Directory: string
}
import fs from 'fs'
import path from 'path'

class FileSession implements Session_Accessor {
  dir: string

  constructor (args: SessionFile_Args) {
    if (!args.Directory) {
      throw new Error("'Directory' is required in 'File' configuration type")
    }
    this.dir = args.Directory
    if (!fs.lstatSync(this.dir).isDirectory()) {
      throw new Error(`Directory ${this.dir} doesn't exist`)
    }
  }

  get (id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      fs.readFile(path.join(this.dir, id), (err, data) => {
        if (err) return reject(err)
        try {
          resolve(JSON.parse(data.toString()))
        } catch (err) {
          reject(`Error when parsing session file (${err})`)
        }
      })
    })
  }

  update (data: LLNG_Session) {
    return new Promise<boolean>((resolve, reject) => {
      fs.writeFile(
        path.join(this.dir, data._session_id),
        JSON.stringify(data),
        err => {
          if (err) return reject(err)
          resolve(true)
        }
      )
    })
  }
}

export default FileSession
