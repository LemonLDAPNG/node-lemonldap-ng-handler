/**
 * Typescript declarations
 */
export interface PerlDBI_Args {
  dbiChain: string
  dbiUser: string | undefined
  dbiPassword: string | undefined
}

const btype = {
  SQLite: 'sqlite3',
  Pg: 'pg',
  mysql: 'mysql',
  Oracle: 'oracledb'
}

type DB = 'sqlite3' | 'pg' | 'mysql' | 'oracledb'

const convert = {
  database: 'database',
  dbname: 'database',
  host: 'host',
  port: 'port',
  encoding: 'encoding',
  sid: 'sid'
}

import { Knex } from 'knex'

import knex from 'knex'

export type PerlDBI_Client = Knex

export default function PerlDBI<PerlDBI_Client> (args: PerlDBI_Args) {
  if (!args.dbiChain.match(/^dbi:(SQLite|Pg|mysql):(.*)/)) {
    throw new Error(`Invalid dbiChain: ${args.dbiChain}`)
  }
  const type: DB | undefined = btype[RegExp.$1 as keyof typeof btype] as DB
  if (!type) {
    throw new Error(`Unsupported database type: ${RegExp.$1}`)
  }
  let dbArgs: Knex.Config = {}
  dbArgs.client = type
  dbArgs.connection = {}
  RegExp.$2.split(/;/).map((s: string) => {
    let kv = s.match(/^(.*?)=(.*)$/)
    if (kv) {
      let k: string = convert[kv[1] as keyof typeof convert]
      if (k && k !== 'type') {
        if (type === 'sqlite3' && k === 'database') k = 'filename'
        // @ts-ignore
        dbArgs.connection[k] = kv[2]
      } else {
        throw new Error(`Unknown DB argument ${k}`)
      }
    }
  })
  if (type === 'sqlite3') {
    // @ts-ignore
    if (!dbArgs.connection.filename) {
      throw new Error('database should be defined')
    }
    // @ts-ignore
    if (!/^(?:\.|\/)/.test(dbArgs.connection.filename)) {
      throw new Error('database must be a path')
    }
    dbArgs.useNullAsDefault = true
  }
  return knex(dbArgs)
}
