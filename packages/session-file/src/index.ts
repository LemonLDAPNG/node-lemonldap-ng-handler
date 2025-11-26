import { LLNG_Session, Session_Accessor } from "@lemonldap-ng/types";
type SessionFile_Args = {
  Directory: string;
};
import fs from "fs";
import path from "path";

class FileSession implements Session_Accessor {
  dir: string;

  constructor(args: SessionFile_Args) {
    if (!args.Directory) {
      // istanbul ignore next
      throw new Error("'Directory' is required in 'File' configuration type");
    }
    this.dir = args.Directory;
    if (!fs.lstatSync(this.dir).isDirectory()) {
      // istanbul ignore next
      throw new Error(`Directory ${this.dir} doesn't exist`);
    }
  }

  get(id: string) {
    return new Promise<LLNG_Session>((resolve, reject) => {
      // Validate session ID to prevent path traversal
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
        return reject(new Error("Invalid session ID format"));
      }
      fs.readFile(path.join(this.dir, id), (err, data) => {
        if (err) return reject(err);
        try {
          resolve(JSON.parse(data.toString()));
        } catch (err) {
          // istanbul ignore next
          reject(`Error when parsing session file (${err})`);
        }
      });
    });
  }

  update(data: LLNG_Session) {
    return new Promise<boolean>((resolve, reject) => {
      // Validate session ID to prevent path traversal
      if (!/^[a-zA-Z0-9_-]+$/.test(data._session_id)) {
        return reject(new Error("Invalid session ID format"));
      }
      fs.writeFile(
        path.join(this.dir, data._session_id),
        JSON.stringify(data),
        (err) => {
          if (err) return reject(err);
          resolve(true);
        },
      );
    });
  }
}

export default FileSession;
