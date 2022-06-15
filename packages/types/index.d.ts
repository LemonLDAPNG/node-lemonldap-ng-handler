export interface LLNG_Conf {
  cfgNum: number;
  [key: string]: object | any[] | string | number | boolean;
}
export interface Apache_Session {
  id: string;
  a_session: string;
}
export interface LLNG_Session {
  _session_id: string;
  [key: string]: string | number | boolean;
}
