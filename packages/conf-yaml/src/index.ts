import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import FileConf from '@LLNG/conf-file';

import type {FileArgs} from '@LLNG/conf-file';

class YAMLConf extends FileConf {
  dirName: string;

  constructor(args: FileArgs) {
    super(args);
    this.dirName = args.dirName;
  }

  available() {
    return new Promise<number[]>( (resolve, reject) => {
      fs.readdir(this.dirName, (err, files) => {
        if(err) {
          reject(err);
        } else {
          let res: number[] = [];
          files.map( file => {
            if (/lmConf-(\d+)\.yaml/.test(file)) res.push(parseInt(RegExp.$1));
          });
          res.sort();
          resolve(res);
        }
      });
    });
  }

  load( cfgNum: number, fields: string[] = [] ) {
    return new Promise<object> ( (resolve, reject) => {
      let filename = path.join(this.dirName, `lmConf-${cfgNum.toString()}.yaml`);
      fs.access(filename, fs.constants.R_OK, (err) => {
        if(err) {
          reject(`Unable to read ${filename}: ${err}`);
        } else {
          fs.readFile(filename, (err, data) => {
            if(err) {
              reject(`Unable to read ${filename}: ${err}`);
            } else {
              try {
                return resolve(yaml.load(data.toString()) as object);
              } catch (err) {
                reject(`YAML parsing error: ${err}`);
              }
            }
          });
        }
      });
    });
  }

  store(fields: object) {
    return new Promise<boolean> ( (resolve, reject) => {
      const mask = process.umask(0o027);
      const data = yaml.dump(fields);
      // @ts-ignore
      fs.writeFile( path.join(this.dirName, `lmConf-${fields.cfgNum.toString()}.yaml`), data, (err) => {
        process.umask(mask);
        if (err) {
          // @ts-ignore
          reject(`Unable to write lmConf-${fields.cfgNum.toString()}.yaml`);
        }
        else {
          resolve(true);
        }
      });
    });
  }
}

export default YAMLConf
